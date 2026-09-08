<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Http\Resources\RecordingResource;
use App\Models\LessonCompletion;
use App\Models\Recording;
use App\Models\RecordingProgress;
use App\Models\User;
use App\Services\AccessGuard;
use App\Services\EnrollmentProgressService;
use App\Services\MediaLinkService;
use App\Services\WatermarkService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecordingController extends Controller
{
    public function __construct(
        protected AccessGuard $guard,
        protected MediaLinkService $links,
        protected EnrollmentProgressService $progress,
        protected WatermarkService $watermark,
    ) {}

    /** Library across every batch the student currently has access to. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $batchIds = $this->guard->accessibleBatchIds($user);

        $recordings = Recording::query()
            ->whereIn('batch_id', $batchIds ?: ['-'])
            ->released()
            ->with(['batch.course', 'session.teacher'])
            ->when($request->filled('q'), fn ($query) => $query->where(
                'title',
                'like',
                // % and _ are LIKE wildcards: a student searching "50%" would
                // otherwise match every row.
                '%'.str_replace(['%', '_'], ['\%', '\_'], $request->string('q')->value()).'%',
            ))
            ->orderByDesc('released_at')
            ->paginate($this->perPage(24));

        $progress = RecordingProgress::query()
            ->where('user_id', $user->getKey())
            ->whereIn('recording_id', $recordings->getCollection()->pluck('id'))
            ->get()
            ->keyBy('recording_id');

        $enrollmentByBatch = $user->enrollments()->accessible()->get()->keyBy('batch_id');

        return ApiResponse::paginated($recordings, fn (Recording $recording) => (new RecordingResource($recording))
            ->additional([
                'enrollment_id' => $enrollmentByBatch[$recording->batch_id]->id ?? null,
                'progress_percent' => (int) ($progress[$recording->id]->progress_percent ?? 0),
            ])->toArray($request));
    }

    public function show(Request $request, Recording $recording): JsonResponse
    {
        $this->authorize('view', $recording);

        $recording->load(['batch.course', 'session.teacher']);

        $progress = RecordingProgress::query()
            ->where('user_id', $request->user()->getKey())
            ->where('recording_id', $recording->getKey())
            ->first();

        // index() already includes this; show() omitting it left every
        // single-recording fetch with enrollment_id undefined, which broke
        // both the course-scoped canonicalization redirect and the page's
        // own enrollment-match guard (it fails open when this is missing).
        $enrollment = $this->guard->enrollmentFor($request->user(), $recording->batch_id);

        return ApiResponse::item((new RecordingResource($recording))->additional([
            'enrollment_id' => $enrollment?->id,
            'progress_percent' => (int) ($progress->progress_percent ?? 0),
        ]));
    }

    /**
     * Returns a short-lived playback destination and records the resume point.
     * Called each time playback starts, so revoked access takes effect at once.
     */
    public function playback(Request $request, Recording $recording): JsonResponse
    {
        $this->authorize('play', $recording);

        $data = $request->validate([
            'progress_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'position_seconds' => ['nullable', 'integer', 'min:0'],
        ]);

        $existing = $this->recordProgress($recording, $request->user(), $data);

        $destination = $this->links->forRecording($recording);

        return ApiResponse::destination($destination['url'], $destination['expires_at'], [
            'resume_at_seconds' => (int) $existing->last_position_seconds,
            'provider' => $recording->source,

            // Regenerated per playback so it cannot be cached and stripped,
            // and it names the account a leaked capture came from.
            'watermark' => $this->watermark->forViewer($request->user()),
        ]);
    }

    /**
     * Periodic watch-progress check-in from an already-loaded player.
     *
     * Split out from playback() rather than having the player re-call that:
     * playback() re-authorizes, mints a fresh signed destination and a new
     * watermark payload every time, all of which is pointless overhead for
     * "the student is still watching" pinged every ~15s. This still
     * re-authorizes on every call for the same reason playback() does —
     * access revoked mid-viewing (a refund, an expired enrollment) stops
     * being able to update progress immediately, not just on next load —
     * it just skips regenerating a destination nobody asked for.
     */
    public function progress(Request $request, Recording $recording): JsonResponse
    {
        $this->authorize('play', $recording);

        $data = $request->validate([
            'progress_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'position_seconds' => ['nullable', 'integer', 'min:0'],
        ]);

        $existing = $this->recordProgress($recording, $request->user(), $data);

        return ApiResponse::item([
            'progress_percent' => (int) $existing->progress_percent,
            'completed' => $existing->completed_at !== null,
        ]);
    }

    /**
     * @param  array{progress_percent?: int, position_seconds?: int}  $data
     */
    protected function recordProgress(Recording $recording, User $user, array $data): RecordingProgress
    {
        $existing = RecordingProgress::firstOrNew([
            'recording_id' => $recording->getKey(),
            'user_id' => $user->getKey(),
        ]);

        // A one-way high-water mark: re-watching or seeking backward must
        // never regress an already-reached percentage.
        $percent = max((int) ($existing->progress_percent ?? 0), (int) ($data['progress_percent'] ?? 0));

        // Corroborates $percent against real elapsed time instead of trusting
        // the reported position alone. Each check-in credits at most a few
        // seconds past the last one (capped just above the player's own ~15s
        // interval), so scrubbing straight to the end and letting it play for
        // a moment accumulates almost nothing here even though $percent alone
        // would already read 100 — see completedWithCorroboration() below.
        $sinceLastCheckIn = $existing->last_watched_at !== null
            ? max(0, $existing->last_watched_at->diffInSeconds(now(), false))
            : 0;
        $watchedSeconds = (int) ($existing->watched_seconds ?? 0) + min(20, $sinceLastCheckIn);

        $verified = $this->completedWithCorroboration($recording, $percent, $watchedSeconds);

        $existing->fill([
            'progress_percent' => $percent,
            'last_position_seconds' => $data['position_seconds'] ?? $existing->last_position_seconds ?? 0,
            'watched_seconds' => $watchedSeconds,
            'last_watched_at' => now(),
            'completed_at' => $verified ? ($existing->completed_at ?? now()) : $existing->completed_at,
        ])->save();

        if ($verified) {
            $enrollment = $this->guard->enrollmentFor($user, $recording->batch_id);

            // Watching a lesson's video to the end is completing that
            // lesson — the two used to be entirely separate signals, so a
            // student could watch every recording and still show 0%
            // syllabus progress until they also went and manually ticked
            // every matching checkbox by hand.
            if ($enrollment !== null && filled($recording->syllabus_lesson_id)) {
                LessonCompletion::updateOrCreate(
                    ['user_id' => $user->getKey(), 'syllabus_lesson_id' => $recording->syllabus_lesson_id],
                    ['enrollment_id' => $enrollment->getKey(), 'completed_at' => now()],
                );
            }

            if ($enrollment !== null) {
                $this->progress->recalculate($enrollment);
            }
        }

        return $existing;
    }

    /**
     * Whether a reported high-water-mark of 95%+ is backed by enough actual
     * watch time to count as complete, closing the gap where scrubbing
     * straight to the end and letting it play for a moment reported the
     * same 100% as watching the whole thing.
     */
    protected function completedWithCorroboration(Recording $recording, int $percent, int $watchedSeconds): bool
    {
        if ($percent < 95) {
            return false;
        }

        // Nothing to corroborate against for a recording with no known
        // length — trust the reported position rather than permanently
        // blocking completion.
        if ($recording->duration_seconds === null || $recording->duration_seconds <= 0) {
            return true;
        }

        return $watchedSeconds >= (int) round($recording->duration_seconds * 0.5);
    }
}
