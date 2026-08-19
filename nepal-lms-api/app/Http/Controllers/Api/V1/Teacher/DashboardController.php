<?php

namespace App\Http\Controllers\Api\V1\Teacher;

use App\Enums\BatchStatus;
use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Services\AccessGuard;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Teacher landing page.
 *
 * Scoped entirely to batches this teacher is assigned to — a teacher never
 * sees another teacher's cohort, even in aggregate counts.
 */
class DashboardController extends Controller
{
    use ResolvesTeacherScope;

    public function __construct(
        protected AccessGuard $guard,
        protected SettingsRepository $settings,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $batchIds = $this->guard->taughtBatchIds($user);

        $batches = Batch::query()
            ->whereIn('id', $batchIds ?: ['-'])
            ->with('course:id,title')
            ->withCount(['enrollments as students_count' => fn ($query) => $query->accessible()])
            ->get();

        $todaySessions = ClassSession::query()
            ->whereIn('batch_id', $batchIds ?: ['-'])
            ->whereBetween('starts_at', [now()->startOfDay(), now()->endOfDay()])
            ->with(['batch.course', 'teacher'])
            ->orderBy('starts_at')
            ->get();

        $nextSession = ClassSession::query()
            ->whereIn('batch_id', $batchIds ?: ['-'])
            ->upcoming()
            ->with(['batch.course', 'teacher'])
            ->first();

        $nextSessionsByBatch = $this->nextSessionsFor($batchIds);
        $syllabusPercents = $this->syllabusProgressFor($batchIds);

        return ApiResponse::item([
            'next_session' => $nextSession ? $this->sessionPayload($nextSession) : null,
            'metrics' => [
                'assigned_batches' => $batches->count(),
                'ongoing_batches' => $batches->where('status', BatchStatus::Ongoing)->count(),
                'upcoming_batches' => $batches->where('status', BatchStatus::Open)->count(),
                'classes_today' => $todaySessions->count(),
                'attendance_actions' => $this->pendingAttendanceQuery($batchIds)->count(),
                'active_students' => Enrollment::query()
                    ->whereIn('batch_id', $batchIds ?: ['-'])
                    ->accessible()
                    ->distinct('user_id')
                    ->count('user_id'),
            ],
            'today_sessions' => $todaySessions->map(fn (ClassSession $session) => $this->sessionPayload($session))->all(),
            'follow_ups' => $this->followUps($batchIds),
            'batches' => $batches->map(fn (Batch $batch) => $this->batchPayload(
                $batch,
                $nextSessionsByBatch->get($batch->id, false),
                $syllabusPercents[$batch->id] ?? 0,
            ))->all(),
        ]);
    }

    /** Concrete items the teacher still owes, most time-sensitive first. */
}
