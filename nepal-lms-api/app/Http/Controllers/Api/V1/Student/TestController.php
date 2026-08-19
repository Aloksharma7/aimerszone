<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Http\Resources\StudentTestResource;
use App\Models\Test;
use App\Models\TestAttempt;
use App\Services\AccessGuard;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TestController extends Controller
{
    public function __construct(protected AccessGuard $guard) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $batchIds = $this->guard->accessibleBatchIds($user);
        $enrollmentByBatch = $user->enrollments()->accessible()->get()->keyBy('batch_id');

        $tests = Test::query()
            ->whereIn('batch_id', $batchIds ?: ['-'])
            ->visibleToStudents()
            ->with('course:id,title')
            ->orderByDesc('opens_at')
            ->get();

        $attempts = TestAttempt::query()
            ->where('user_id', $user->getKey())
            ->whereIn('test_id', $tests->pluck('id'))
            ->selectRaw('test_id, count(*) as used, max(score) as best')
            ->groupBy('test_id')
            ->get()
            ->keyBy('test_id');

        return ApiResponse::collection($tests->map(fn (Test $test) => (new StudentTestResource($test))->additional([
            'enrollment_id' => $enrollmentByBatch[$test->batch_id]->id ?? null,
            'attempts_used' => (int) ($attempts[$test->id]->used ?? 0),
            'best_score' => $attempts[$test->id]->best ?? null,
        ])->toArray($request)));
    }

    /**
     * Pre-attempt screen. Deliberately returns no questions — those are only
     * created with the attempt, so a student cannot read the paper early.
     */
    public function launch(Request $request, Test $test): JsonResponse
    {
        $this->authorize('view', $test);

        $used = TestAttempt::where('test_id', $test->getKey())
            ->where('user_id', $request->user()->getKey())
            ->count();

        $reason = $this->blockingReason($test, $used, $request);

        return ApiResponse::item([
            'id' => $test->id,
            'title' => $test->title,
            'course_title' => $test->course?->title,
            'total_marks' => (int) $test->total_marks,
            'duration_seconds' => (int) $test->duration_minutes * 60,
            'attempts_used' => $used,
            'attempts_allowed' => (int) $test->attempts_allowed,
            'status' => $test->status->value,
            'can_start' => $reason === null,
            'reason' => $reason,
        ]);
    }

    protected function blockingReason(Test $test, int $used, Request $request): ?string
    {
        if (! $test->isOpenNow()) {
            return $test->opens_at?->isFuture()
                ? 'This test opens '.$test->opens_at->toIso8601String()
                : 'This test is closed.';
        }

        if ($used >= $test->attempts_allowed) {
            return 'You have used all attempts for this test.';
        }

        if (! $this->guard->studentCanAccessBatch($request->user(), $test->batch_id)) {
            return 'Your access to this batch is not active.';
        }

        return null;
    }
}
