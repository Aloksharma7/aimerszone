<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Http\Resources\AnnouncementResource;
use App\Http\Resources\ClassSessionResource;
use App\Http\Resources\EnrollmentResource;
use App\Http\Resources\RecordingResource;
use App\Http\Resources\StudentTestResource;
use App\Models\Announcement;
use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Models\Recording;
use App\Models\RecordingProgress;
use App\Models\Test;
use App\Models\TestAttempt;
use App\Services\EnrollmentProgressService;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ApiStudentDashboard. Everything is scoped to the batches this student
 * currently holds access to; no id from the request is trusted here at all.
 */
class DashboardController extends Controller
{
    public function __construct(
        protected EnrollmentProgressService $progress,
        protected SettingsRepository $settings,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        $enrollments = Enrollment::query()
            ->where('user_id', $user->getKey())
            ->accessible()
            ->with(['course.category', 'batch.teachers', 'batch.course'])
            ->get();

        $batchIds = $enrollments->pluck('batch_id')->all();
        $courseIds = $enrollments->pluck('course_id')->all();
        $enrollmentByBatch = $enrollments->keyBy('batch_id');
        $nextActionContext = $this->progress->nextActionContextFor($batchIds);

        return ApiResponse::item([
            'next_class' => $this->nextClass($batchIds, $enrollmentByBatch, $request),
            'active_courses' => $enrollments->map(fn (Enrollment $enrollment) => (new EnrollmentResource($enrollment))
                ->additional(['next_action' => $this->progress->nextAction(
                    $enrollment,
                    $nextActionContext['liveSoon'][$enrollment->batch_id] ?? false,
                    $nextActionContext['openTest'][$enrollment->batch_id] ?? false,
                )])
                ->toArray($request))->values()->all(),
            'upcoming_tests' => $this->upcomingTests($user->getKey(), $batchIds, $enrollmentByBatch, $request),
            'announcements' => $this->announcements($user->getKey(), $batchIds, $courseIds, $request),
            'continue_recording' => $this->continueRecording($user->getKey(), $batchIds, $enrollmentByBatch, $request),
            'payment_review_count' => $user->payments()->pendingReview()->count(),
        ]);
    }

    protected function nextClass(array $batchIds, $enrollmentByBatch, Request $request): ?array
    {
        if ($batchIds === []) {
            return null;
        }

        $session = ClassSession::query()
            ->whereIn('batch_id', $batchIds)
            ->upcoming()
            ->with(['batch.course', 'teacher'])
            ->first();

        if ($session === null) {
            return null;
        }

        $open = $session->joinWindowIsOpen(
            $this->settings->int('operations.join_window_minutes_before', 15),
            $this->settings->int('operations.join_window_minutes_after', 20),
        );

        // The scheduled window opening isn't the same as the teacher actually
        // starting the class — without this, the dashboard card would offer a
        // working join link before anyone has shown up to teach.
        $canJoin = $open && $session->status->value === 'live';

        return (new ClassSessionResource($session))->additional([
            'enrollment_id' => $enrollmentByBatch[$session->batch_id]->id ?? null,
            'join_available' => $canJoin,
            'action_reason' => $canJoin ? null : ($open ? 'Waiting for the teacher to start' : 'Opens shortly before class'),
        ])->toArray($request);
    }

    protected function upcomingTests(string $userId, array $batchIds, $enrollmentByBatch, Request $request): array
    {
        if ($batchIds === []) {
            return [];
        }

        $tests = Test::query()
            ->whereIn('batch_id', $batchIds)
            ->visibleToStudents()
            ->where(fn ($query) => $query->whereNull('closes_at')->orWhere('closes_at', '>', now()->subDays(7)))
            ->with('course:id,title')
            ->orderBy('opens_at')
            ->limit(5)
            ->get();

        $attemptCounts = TestAttempt::query()
            ->where('user_id', $userId)
            ->whereIn('test_id', $tests->pluck('id'))
            ->selectRaw('test_id, count(*) as used, max(score) as best')
            ->groupBy('test_id')
            ->get()
            ->keyBy('test_id');

        return $tests->map(fn (Test $test) => (new StudentTestResource($test))->additional([
            'enrollment_id' => $enrollmentByBatch[$test->batch_id]->id ?? null,
            'attempts_used' => (int) ($attemptCounts[$test->id]->used ?? 0),
            'best_score' => $attemptCounts[$test->id]->best ?? null,
        ])->toArray($request))->values()->all();
    }

    protected function announcements(string $userId, array $batchIds, array $courseIds, Request $request): array
    {
        $announcements = Announcement::query()
            ->published()
            ->forStudent($batchIds, $courseIds)
            ->with(['course:id,title', 'batch.course:id,title'])
            ->orderByDesc('pinned')
            ->orderByDesc('published_at')
            ->limit(5)
            ->get();

        $read = DB::table('announcement_reads')
            ->where('user_id', $userId)
            ->whereIn('announcement_id', $announcements->pluck('id'))
            ->pluck('announcement_id')
            ->flip();

        return $announcements->map(fn (Announcement $announcement) => (new AnnouncementResource($announcement))
            ->additional(['read' => $read->has($announcement->id)])
            ->toArray($request))->values()->all();
    }

    /** The most recently watched recording that is not finished yet. */
    protected function continueRecording(string $userId, array $batchIds, $enrollmentByBatch, Request $request): ?array
    {
        if ($batchIds === []) {
            return null;
        }

        $progress = RecordingProgress::query()
            ->where('user_id', $userId)
            ->whereNull('completed_at')
            ->whereHas('recording', fn ($query) => $query->whereIn('batch_id', $batchIds)->released())
            ->orderByDesc('last_watched_at')
            ->first();

        if ($progress === null) {
            return null;
        }

        $recording = Recording::with(['batch.course', 'session.teacher'])->find($progress->recording_id);

        if ($recording === null) {
            return null;
        }

        return (new RecordingResource($recording))->additional([
            'enrollment_id' => $enrollmentByBatch[$recording->batch_id]->id ?? null,
            'progress_percent' => (int) $progress->progress_percent,
        ])->toArray($request);
    }
}
