<?php

namespace App\Http\Controllers\Api\V1\Teacher;

use App\Enums\AnnouncementAudience;
use App\Enums\AnnouncementStatus;
use App\Enums\ClassSessionStatus;
use App\Jobs\ProvisionClassMeetings;
use Carbon\Carbon;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Batch;
use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Services\AccessGuard;
use App\Services\AuditLogger;
use App\Services\Integrations\ClassMeetingService;
use App\Services\NotificationDispatcher;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Class scheduling and the host start path.
 *
 * A provider outage never blocks a class: creation succeeds even when Zoom is
 * unreachable, and the teacher can publish a manual fallback link that students
 * receive instead.
 */
class ClassSessionController extends Controller
{
    use ResolvesTeacherScope;

    public function __construct(
        protected AccessGuard $guard,
        protected ClassMeetingService $meetings,
        protected NotificationDispatcher $notifications,
        protected AuditLogger $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $sessions = ClassSession::query()
            ->whereIn('batch_id', $this->guard->taughtBatchIds($request->user()) ?: ['-'])
            ->with(['batch.course', 'teacher'])
            ->when($request->filled('batch_id'), fn ($query) => $query->where('batch_id', $request->string('batch_id')->value()))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->when($request->filled('from'), fn ($query) => $query->where('starts_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($query) => $query->where('starts_at', '<=', $request->date('to')))
            ->orderByDesc('starts_at')
            ->paginate($this->perPage(50));

        // One grouped query for the whole page instead of one per row.
        $studentCounts = Enrollment::query()
            ->whereIn('batch_id', $sessions->pluck('batch_id')->unique()->all() ?: ['-'])
            ->accessible()
            ->selectRaw('batch_id, COUNT(*) as total')
            ->groupBy('batch_id')
            ->pluck('total', 'batch_id');

        return ApiResponse::paginated($sessions, fn (ClassSession $session) => $this->sessionPayload(
            $session,
            (int) ($studentCounts[$session->batch_id] ?? 0),
        ));
    }

    public function show(Request $request, string $sessionId): JsonResponse
    {
        $session = $this->resolveSession($sessionId, $request->user());

        return ApiResponse::item(array_merge($this->sessionPayload($session), [
            'zoom_meeting_id' => $session->zoom_meeting_id,
            'zoom_sync_status' => $session->zoom_sync_status,
            'zoom_sync_message' => $session->zoom_sync_message,
            'zoom_synced_at' => $session->zoom_synced_at?->toIso8601String(),
            'fallback_active' => (bool) $session->fallback_active,
            'fallback_note' => $session->fallback_note,
        ]));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'batch_id' => ['required', 'string'],
            'title' => ['required', 'string', 'min:3', 'max:180'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'instructions' => ['nullable', 'string', 'max:2000'],
        ]);

        $batch = $this->resolveBatch($data['batch_id'], $request->user());

        $session = ClassSession::create([
            'batch_id' => $batch->getKey(),
            'teacher_id' => $request->user()->getKey(),
            'topic' => $data['title'],
            'description' => $data['instructions'] ?? null,
            'status' => ClassSessionStatus::Scheduled->value,
            'starts_at' => $data['starts_at'],
            'ends_at' => $data['ends_at'],
            'provider' => 'zoom',
            'created_by' => $request->user()->getKey(),
        ]);

        // Best effort: a failure here marks the session for manual fallback
        // rather than rolling back the class the teacher just scheduled.
        $this->meetings->provision($session);

        $this->audit->log('class.created', $session, $request->user());

        $this->announceNewClass(
            $batch,
            $request->user()->getKey(),
            'New class scheduled: '.$session->topic,
            sprintf(
                'A new class, "%s", has been scheduled for %s.',
                $session->topic,
                $session->starts_at->timezone('Asia/Kathmandu')->format('l, j F Y \a\t g:i A'),
            ),
        );

        return ApiResponse::item(['id' => $session->id], status: 201);
    }

    /**
     * Creates a repeating schedule in one action.
     *
     * A teacher running a daily batch would otherwise fill the same form thirty
     * times. Each occurrence is a real session row rather than a recurrence
     * rule, because individual classes get rescheduled, cancelled and given
     * their own topic — a rule would have to be exploded the first time any of
     * that happened.
     *
     * Zoom meetings are provisioned per session, best effort: a provider
     * failure marks that one for manual fallback and the rest still land.
     */
    public function storeRecurring(Request $request): JsonResponse
    {
        $data = $request->validate([
            'batch_id' => ['required', 'string'],
            'title' => ['required', 'string', 'min:3', 'max:180'],
            'instructions' => ['nullable', 'string', 'max:2000'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'start_time' => ['required', 'date_format:H:i'],
            'duration_minutes' => ['required', 'integer', 'min:10', 'max:600'],
            'frequency' => ['required', Rule::in(['daily', 'weekly'])],

            // Sunday=0 through Saturday=6, matching the frontend's day picker.
            'days' => ['required_if:frequency,weekly', 'array', 'max:7'],
            'days.*' => ['integer', 'min:0', 'max:6'],

            'number_the_topics' => ['nullable', 'boolean'],
        ]);

        $batch = $this->resolveBatch($data['batch_id'], $request->user());

        $start = Carbon::parse($data['start_date'])->startOfDay();
        $end = Carbon::parse($data['end_date'])->endOfDay();

        // A guard rather than a preference: an accidental multi-year range
        // would create thousands of Zoom meetings before anyone noticed.
        if ($start->diffInDays($end) > 180) {
            throw DomainException::unprocessable(
                'Schedule at most six months at a time.',
                'recurrence_range_too_long',
            );
        }

        $days = $data['frequency'] === 'daily'
            ? range(0, 6)
            : array_values(array_unique($data['days'] ?? []));

        if ($days === []) {
            throw DomainException::unprocessable('Choose at least one day of the week.', 'no_days_selected');
        }

        [$hour, $minute] = array_map('intval', explode(':', $data['start_time']));

        $created = [];
        $skipped = 0;

        DB::transaction(function () use ($start, $end, $days, $hour, $minute, $data, $batch, $request, &$created, &$skipped) {
            $occurrence = 0;

            for ($cursor = $start->copy(); $cursor->lte($end); $cursor->addDay()) {
                if (! in_array($cursor->dayOfWeek, $days, true)) {
                    continue;
                }

                $startsAt = $cursor->copy()->setTime($hour, $minute);

                // Skip anything already in the past: scheduling a batch that
                // began last week should only create the classes still to come.
                if ($startsAt->isPast()) {
                    $skipped++;

                    continue;
                }

                $occurrence++;

                $topic = ($data['number_the_topics'] ?? true)
                    ? $data['title'].' — '.$occurrence
                    : $data['title'];

                $created[] = ClassSession::create([
                    'batch_id' => $batch->getKey(),
                    'teacher_id' => $request->user()->getKey(),
                    'topic' => mb_substr($topic, 0, 180),
                    'description' => $data['instructions'] ?? null,
                    'status' => ClassSessionStatus::Scheduled->value,
                    'starts_at' => $startsAt,
                    'ends_at' => $startsAt->copy()->addMinutes($data['duration_minutes']),
                    'provider' => 'zoom',
                    'created_by' => $request->user()->getKey(),
                ]);
            }
        });

        if ($created === []) {
            throw DomainException::unprocessable(
                'That schedule produced no future classes. Check the dates and days.',
                'no_sessions_created',
            );
        }

        /*
         * Off the request: a term can be a hundred classes, and provisioning
         * them inline meant that many Zoom calls in one HTTP request — past
         * PHP's execution limit, so the teacher saw a timeout and could not
         * tell whether anything had been created.
         */
        ProvisionClassMeetings::dispatch(collect($created)->pluck('id')->all());

        $this->audit->log('class.recurring_created', $batch, $request->user(), properties: [
            'created' => count($created),
            'skipped_past' => $skipped,
            'frequency' => $data['frequency'],
        ]);

        // One announcement for the whole batch of classes, not one per
        // session — a term can be a hundred occurrences, and a hundred
        // separate notices would bury everything else in the feed.
        $this->announceNewClass(
            $batch,
            $request->user()->getKey(),
            'New classes scheduled: '.$data['title'],
            sprintf(
                '%d new classes for "%s" have been added, from %s to %s.',
                count($created),
                $data['title'],
                $created[0]->starts_at->timezone('Asia/Kathmandu')->format('j F Y'),
                end($created)->starts_at->timezone('Asia/Kathmandu')->format('j F Y'),
            ),
        );

        return ApiResponse::item([
            'created' => count($created),
            'skipped_past' => $skipped,
            'first_at' => $created[0]->starts_at->toIso8601String(),
            'last_at' => end($created)->starts_at->toIso8601String(),

            // Meetings arrive shortly after; the classes themselves already exist.
            'meetings_pending' => $this->meetings->enabled(),
        ], status: 201);
    }

    /**
     * Cancels a class.
     *
     * Deliberately not a delete: students may already have planned around it,
     * attendance may exist, and the cancellation itself is information. The row
     * stays visible with its reason.
     */
    public function cancel(Request $request, string $sessionId): JsonResponse
    {
        $session = $this->resolveSession($sessionId, $request->user());

        $this->authorize('manage', $session);

        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        if ($session->status === ClassSessionStatus::Completed) {
            throw DomainException::conflict('A completed class cannot be cancelled.', 'session_completed');
        }

        if ($session->status === ClassSessionStatus::Cancelled) {
            return ApiResponse::item(['status' => 'cancelled']);
        }

        $session->forceFill([
            'status' => ClassSessionStatus::Cancelled->value,
            'cancellation_reason' => $data['reason'],
        ])->save();

        // The Zoom meeting is released so it cannot be joined from a stale link.
        if (filled($session->zoom_meeting_id)) {
            $this->meetings->cancel($session);
        }

        $this->audit->log('class.cancelled', $session, $request->user(), $data['reason']);

        return ApiResponse::item(['status' => 'cancelled']);
    }

    public function update(Request $request, string $sessionId): JsonResponse
    {
        $session = $this->resolveSession($sessionId, $request->user());

        $this->authorize('manage', $session);

        $data = $request->validate([
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        if ($session->status === ClassSessionStatus::Completed) {
            throw DomainException::conflict('A completed class cannot be rescheduled.', 'session_completed');
        }

        $session->forceFill([
            'rescheduled_from' => $session->starts_at,
            'starts_at' => $data['starts_at'],
            'ends_at' => $data['ends_at'],
            'reschedule_reason' => $data['reason'],
            'status' => ClassSessionStatus::Scheduled->value,
        ])->save();

        $this->meetings->reschedule($session);

        $this->audit->log('class.rescheduled', $session, $request->user(), $data['reason']);

        return ApiResponse::item($this->sessionPayload($session->fresh()->load('batch.course')));
    }

    /**
     * Hands the teacher the Zoom host URL.
     *
     * Issued at the moment of use and never stored client-side, which is why
     * the frontend redirects immediately rather than rendering a link.
     */
    public function start(Request $request, string $sessionId): JsonResponse
    {
        $session = $this->resolveSession($sessionId, $request->user());

        $this->authorize('start', $session);

        if (! $this->startAvailable($session)) {
            throw DomainException::conflict(
                'The host link opens 30 minutes before the class starts.',
                'start_window_closed',
            );
        }

        if (blank($session->zoom_start_url)) {
            $this->meetings->sync($session);
            $session->refresh();
        }

        // Mirrors the student join() fallback: a provider outage (or, as on a
        // free Zoom plan, no provider integration at all) must not block the
        // teacher's own start path any more than it blocks the student's —
        // the manual link the teacher published is exactly what students are
        // about to be handed, so it is what "start" opens too.
        $redirectUrl = $session->zoom_start_url ?: ($session->fallback_active ? $session->fallback_join_url : null);

        if (blank($redirectUrl)) {
            throw DomainException::conflict(
                'No host link is available. Publish a manual fallback link so students can still join.',
                'host_link_unavailable',
            );
        }

        $session->forceFill([
            'status' => ClassSessionStatus::Live->value,
            'actual_started_at' => $session->actual_started_at ?? now(),
        ])->save();

        $this->audit->log('class.started', $session, $request->user());

        // Sent on the actual start, not on a schedule: a notice that arrives
        // before the class is genuinely live trains students to ignore it.
        $notified = $this->notifications->classStarted($session);

        return ApiResponse::item(['redirect_url' => $redirectUrl, 'students_notified' => $notified])
            ->header('Cache-Control', 'no-store, private');
    }

    public function sync(Request $request, string $sessionId): JsonResponse
    {
        $session = $this->resolveSession($sessionId, $request->user());

        $this->authorize('manage', $session);

        $session = $this->meetings->sync($session);

        return ApiResponse::item([
            'zoom_sync_status' => $session->zoom_sync_status,
            'zoom_sync_message' => $session->zoom_sync_message,
            'zoom_synced_at' => $session->zoom_synced_at?->toIso8601String(),
        ]);
    }

    /**
     * Publishes a manual join link. This overrides the Zoom link for students,
     * so it is the escape hatch when the provider is down at class time.
     */
    public function fallback(Request $request, string $sessionId): JsonResponse
    {
        $session = $this->resolveSession($sessionId, $request->user());

        $this->authorize('manage', $session);

        $data = $request->validate([
            'provider' => ['nullable', 'string', 'max:40'],
            'reference' => ['required', 'string', 'min:3', 'max:500'],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        // Only an absolute http(s) URL is accepted: students are redirected to
        // whatever is stored here.
        $url = trim($data['reference']);

        if (! filter_var($url, FILTER_VALIDATE_URL) || ! str_starts_with($url, 'https://')) {
            throw DomainException::unprocessable(
                'Enter the full meeting link, starting with https://',
                'invalid_fallback_url',
                ['reference' => ['Enter a complete https:// meeting link.']],
            );
        }

        $session->forceFill([
            'fallback_join_url' => $url,
            'fallback_note' => $data['reason'],
            'fallback_active' => true,
        ])->save();

        $this->audit->log('class.fallback_published', $session, $request->user(), $data['reason'], [
            'provider' => $data['provider'] ?? 'manual',
        ]);

        return ApiResponse::item(['fallback_active' => true]);
    }

    /**
     * Puts a new class on the batch's notification feed and announcement list.
     *
     * Scheduling a class previously left enrolled students to discover it only
     * by reloading a page that happened to list classes — nothing told them one
     * had been added. This reuses the same Announcement mechanism a teacher's
     * manual announcement uses, so it shows up in the student portal's
     * notification bell exactly the same way.
     */
    protected function announceNewClass(Batch $batch, string $creatorId, string $title, string $body): void
    {
        Announcement::create([
            'title' => Str::limit($title, 177),
            'summary' => Str::limit($body, 200),
            'body' => $body,
            'audience' => AnnouncementAudience::Batch->value,
            'batch_id' => $batch->getKey(),
            'course_id' => $batch->course_id,
            'channel' => 'portal',
            'status' => AnnouncementStatus::Published->value,
            'published_at' => now(),
            'created_by' => $creatorId,
        ]);
    }
}
