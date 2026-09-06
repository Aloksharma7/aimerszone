<?php

namespace App\Http\Controllers\Api\V1\Teacher;

use App\Enums\AttendanceStatus;
use App\Exceptions\DomainException;
use App\Jobs\RecalculateBatchProgress;
use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Services\AccessGuard;
use App\Services\AttendanceImportService;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The attendance register.
 *
 * The teacher's finalized register is the authoritative record. Join-link
 * presence and the Zoom participant report are both only suggestions that the
 * teacher confirms or overrides.
 */
class AttendanceController extends Controller
{
    use ResolvesTeacherScope;

    public function __construct(
        protected AccessGuard $guard,
        protected AttendanceImportService $importer,
        protected AuditLogger $audit,
    ) {}

    /** Sessions awaiting a register, oldest first. */
    public function index(Request $request): JsonResponse
    {
        $batchIds = $this->guard->taughtBatchIds($request->user()) ?: ['-'];

        $sessions = ClassSession::query()
            ->whereIn('batch_id', $batchIds)
            ->where('starts_at', '<', now())
            ->with('batch')
            ->withCount(['attendances as students_count'])
            ->orderByDesc('starts_at')
            ->limit($this->perPage(50))
            ->get();

        $rows = $sessions->map(fn (ClassSession $session) => [
            'id' => $session->id,
            'title' => $session->topic,
            'batch_title' => $session->batch?->title ?? 'Batch removed',
            'starts_at' => $session->starts_at->toIso8601String(),
            'students_count' => (int) $session->students_count,
            'status' => $session->attendanceFinalized() ? 'finalized' : 'pending',
        ])->values();

        return ApiResponse::item([
            'sessions' => $rows->all(),
            'metrics' => [
                'awaiting' => $rows->where('status', 'pending')->count(),
                'finalized_this_week' => ClassSession::query()
                    ->whereIn('batch_id', $batchIds)
                    ->where('attendance_finalized_at', '>=', now()->startOfWeek())
                    ->count(),
                'assigned_students' => Enrollment::query()
                    ->whereIn('batch_id', $batchIds)
                    ->accessible()
                    ->distinct('user_id')
                    ->count('user_id'),
            ],
        ]);
    }

    public function show(Request $request, string $sessionId): JsonResponse
    {
        $session = $this->resolveSession($sessionId, $request->user());

        $enrollments = Enrollment::query()
            ->where('batch_id', $session->batch_id)
            ->accessible()
            ->with('user:id,name,student_code')
            ->get();

        $attendances = Attendance::query()
            ->where('class_session_id', $session->getKey())
            ->get()
            ->keyBy('user_id');

        $participants = $enrollments->map(function (Enrollment $enrollment) use ($attendances) {
            $record = $attendances->get($enrollment->user_id);

            return [
                'student_id' => $enrollment->user_id,
                'student_name' => $enrollment->user?->name ?? 'Removed account',
                'participant_name' => $record?->source === 'zoom_import' ? $record->note : null,
                'duration_seconds' => $record ? (int) $record->minutes_attended * 60 : null,
                'match_confidence' => $this->confidence($record),
                'attendance_status' => $record?->status->value ?? AttendanceStatus::Absent->value,
                'override_reason' => $record?->note,
            ];
        });

        return ApiResponse::item([
            'session' => $this->sessionPayload($session, $enrollments->count()),
            'summary' => [
                'enrolled' => $enrollments->count(),
                'matched' => $participants->where('match_confidence', 'high')->count(),
                'unmatched' => $participants->where('match_confidence', 'none')->count(),
                'needs_review' => $participants->where('match_confidence', 'low')->count(),
                'finalized' => $session->attendanceFinalized(),
            ],
            'participants' => $participants->values()->all(),
        ]);
    }

    /** Saves overrides without closing the register. */
    public function save(Request $request, string $sessionId): JsonResponse
    {
        $session = $this->resolveSession($sessionId, $request->user());

        $this->authorize('manage', $session);

        $this->assertOpen($session);

        $data = $this->validatedParticipants($request);

        $this->apply($session, $data['participants'], $request, finalize: false);

        return ApiResponse::item(['saved' => count($data['participants'])]);
    }

    /**
     * Closes the register. Once finalized the record stops moving: student
     * join links no longer alter it, and progress is recalculated from it.
     */
    public function finalize(Request $request, string $sessionId): JsonResponse
    {
        $session = $this->resolveSession($sessionId, $request->user());

        $this->authorize('finalizeAttendance', $session);

        $this->assertOpen($session);

        $data = $this->validatedParticipants($request);

        // "Review" means the teacher has not decided yet. Finalizing with rows
        // still in that state would freeze an undecided register and feed a
        // misleading attendance percentage into student progress.
        $undecided = collect($data['participants'])
            ->where('attendance_status', AttendanceStatus::Review->value)
            ->count();

        if ($undecided > 0) {
            throw DomainException::unprocessable(
                $undecided.' student(s) are still marked for review. Resolve them before finalizing.',
                'attendance_undecided',
            );
        }

        DB::transaction(function () use ($session, $data, $request) {
            $this->apply($session, $data['participants'], $request, finalize: true);

            $session->forceFill([
                'attendance_finalized_at' => now(),
                'attendance_finalized_by' => $request->user()->getKey(),
                'status' => \App\Enums\ClassSessionStatus::Completed->value,
                'actual_ended_at' => $session->actual_ended_at ?? now(),
            ])->save();
        });

        // Attendance feeds each student's progress figure, but recalculating a
        // whole batch inline would put a thousand-plus queries inside the
        // teacher's request. Same work, off the request.
        RecalculateBatchProgress::dispatch($session->batch_id);

        $this->audit->log('attendance.finalized', $session, $request->user(), properties: [
            'participants' => count($data['participants']),
        ]);

        return ApiResponse::item(['finalized' => true]);
    }

    /**
     * Pulls the Zoom participant report and pre-fills the register.
     *
     * Existing manual overrides are preserved — an import must never quietly
     * undo a decision the teacher already made.
     */
    public function import(Request $request, string $sessionId): JsonResponse
    {
        $session = $this->resolveSession($sessionId, $request->user());

        $this->authorize('manage', $session);

        $this->assertOpen($session);

        $result = $this->importer->importFromZoom($session);

        if ($result['status'] === 'no_meeting') {
            throw DomainException::conflict($result['message'], 'no_meeting_to_import');
        }

        if ($result['status'] === 'api_error') {
            throw DomainException::conflict($result['message'], 'import_failed');
        }

        if ($result['status'] === 'no_report_yet') {
            return ApiResponse::item(['imported' => 0, 'message' => $result['message']]);
        }

        $this->audit->log('attendance.imported', $session, $request->user(), properties: [
            'reported' => $result['reported'],
            'matched' => $result['imported'],
        ]);

        return ApiResponse::item([
            'imported' => $result['imported'],
            'reported' => $result['reported'],
        ]);
    }

    /* ----------------------------------------------------------------
     | Helpers
     | ---------------------------------------------------------------- */

    protected function assertOpen(ClassSession $session): void
    {
        if ($session->attendanceFinalized()) {
            throw DomainException::conflict(
                'This register was already finalized. Ask an administrator to reopen it.',
                'attendance_finalized',
            );
        }
    }

    protected function validatedParticipants(Request $request): array
    {
        return $request->validate([
            'participants' => ['required', 'array', 'max:1000'],
            'participants.*.student_id' => ['required', 'string'],
            'participants.*.attendance_status' => ['required', Rule::in(AttendanceStatus::values())],
            'participants.*.override_reason' => ['nullable', 'string', 'max:300'],
        ]);
    }

    protected function apply(ClassSession $session, array $participants, Request $request, bool $finalize): void
    {
        // Only students actually enrolled in this batch may be marked, so a
        // hand-edited payload cannot create attendance for an outsider.
        $enrollments = Enrollment::query()
            ->where('batch_id', $session->batch_id)
            ->accessible()
            ->get()
            ->keyBy('user_id');

        foreach ($participants as $participant) {
            $enrollment = $enrollments->get($participant['student_id']);

            if ($enrollment === null) {
                continue;
            }

            Attendance::updateOrCreate(
                ['class_session_id' => $session->getKey(), 'user_id' => $enrollment->user_id],
                [
                    'enrollment_id' => $enrollment->getKey(),
                    'status' => $participant['attendance_status'],
                    'note' => $participant['override_reason'] ?? null,
                    'source' => 'manual',
                    'marked_by' => $request->user()->getKey(),
                    'marked_at' => now(),
                ],
            );
        }
    }

    /**
     * How much the record can be trusted before the teacher reviews it:
     * a manual mark is definitive, an import is high, a join link is low.
     */
    protected function confidence(?Attendance $record): string
    {
        return match (true) {
            $record === null => 'none',
            $record->source === 'manual' => 'high',
            $record->source === 'zoom_import' => 'high',
            default => 'low',
        };
    }

    /**
     * Zoom reports display names, which students set themselves. Email is the
     * reliable key; the name comparison is a normalized fallback.
     *
     * @param  array<int, array{name: string, email: ?string, duration: int}>  $participants
     */
    protected function matchParticipant(array $participants, Enrollment $enrollment): ?array
    {
        $email = mb_strtolower((string) $enrollment->user?->email);
        $name = $this->normalize((string) $enrollment->user?->name);

        foreach ($participants as $participant) {
            if (filled($email) && mb_strtolower((string) $participant['email']) === $email) {
                return $participant;
            }
        }

        foreach ($participants as $participant) {
            if ($this->normalize($participant['name']) === $name) {
                return $participant;
            }
        }

        return null;
    }

    protected function normalize(string $value): string
    {
        return preg_replace('/[^a-z]/', '', mb_strtolower($value)) ?: '';
    }
}
