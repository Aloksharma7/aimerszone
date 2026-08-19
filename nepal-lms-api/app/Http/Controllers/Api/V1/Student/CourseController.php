<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Http\Resources\AnnouncementResource;
use App\Http\Resources\ClassSessionResource;
use App\Http\Resources\EnrollmentResource;
use App\Http\Resources\RecordingResource;
use App\Http\Resources\ResourceFileResource;
use App\Http\Resources\StudentTestResource;
use App\Http\Resources\SyllabusModuleResource;
use App\Enums\AccessType;
use App\Enums\EnrollmentStatus;
use App\Exceptions\DomainException;
use App\Models\Announcement;
use App\Models\Attendance;
use App\Models\Batch;
use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Models\LessonCompletion;
use App\Models\Recording;
use App\Models\RecordingProgress;
use App\Models\Resource;
use App\Models\SyllabusLesson;
use App\Models\SyllabusModule;
use App\Models\Test;
use App\Models\TestAttempt;
use App\Services\EnrollmentProgressService;
use App\Services\AuditLogger;
use App\Services\FeatureGate;
use App\Services\NotificationDispatcher;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The course workspace.
 *
 * Every method resolves the enrollment from the signed-in user first, so an
 * enrollment id belonging to someone else resolves to a 404 rather than
 * leaking that it exists.
 */
class CourseController extends Controller
{
    public function __construct(
        protected EnrollmentProgressService $progress,
        protected SettingsRepository $settings,
        protected FeatureGate $features,
        protected NotificationDispatcher $notifications,
        protected AuditLogger $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $enrollments = $this->scope($request)
            ->with(['course.category', 'batch.teachers', 'batch.course'])
            ->orderByDesc('created_at')
            ->get();

        $context = $this->progress->nextActionContextFor($enrollments->pluck('batch_id')->unique()->all());

        return ApiResponse::collection($enrollments->map(fn (Enrollment $enrollment) => (new EnrollmentResource($enrollment))
            ->additional(['next_action' => $this->progress->nextAction(
                $enrollment,
                $context['liveSoon'][$enrollment->batch_id] ?? false,
                $context['openTest'][$enrollment->batch_id] ?? false,
            )])
            ->toArray($request)));
    }

    public function show(Request $request, string $enrollmentId): JsonResponse
    {
        $enrollment = $this->find($request, $enrollmentId);

        return ApiResponse::item((new EnrollmentResource($enrollment))
            ->additional(['next_action' => $this->progress->nextAction($enrollment)]));
    }

    public function classes(Request $request, string $enrollmentId): JsonResponse
    {
        $enrollment = $this->find($request, $enrollmentId);

        $before = $this->settings->int('operations.join_window_minutes_before', 15);
        $after = $this->settings->int('operations.join_window_minutes_after', 20);

        $sessions = ClassSession::query()
            ->where('batch_id', $enrollment->batch_id)
            ->with(['batch.course', 'teacher'])
            ->orderBy('starts_at')
            ->get();

        return ApiResponse::collection($sessions->map(function (ClassSession $session) use ($enrollment, $before, $after, $request) {
            $open = $session->joinWindowIsOpen($before, $after);

            return (new ClassSessionResource($session))->additional([
                'enrollment_id' => $enrollment->id,
                'join_available' => $open,
                'action_reason' => $open ? null : $this->joinReason($session),
            ])->toArray($request);
        }));
    }

    public function recordings(Request $request, string $enrollmentId): JsonResponse
    {
        $enrollment = $this->find($request, $enrollmentId);

        $recordings = Recording::query()
            ->where('batch_id', $enrollment->batch_id)
            ->released()
            ->with(['batch.course', 'session.teacher'])
            ->orderByDesc('released_at')
            ->get();

        $progress = RecordingProgress::query()
            ->where('user_id', $request->user()->getKey())
            ->whereIn('recording_id', $recordings->pluck('id'))
            ->get()
            ->keyBy('recording_id');

        return ApiResponse::collection($recordings->map(fn (Recording $recording) => (new RecordingResource($recording))
            ->additional([
                'enrollment_id' => $enrollment->id,
                'progress_percent' => (int) ($progress[$recording->id]->progress_percent ?? 0),
            ])->toArray($request)));
    }

    public function resources(Request $request, string $enrollmentId): JsonResponse
    {
        $enrollment = $this->find($request, $enrollmentId);

        $resources = Resource::query()
            ->released()
            ->where(fn ($query) => $query
                ->where('batch_id', $enrollment->batch_id)
                ->orWhere(fn ($builder) => $builder->whereNull('batch_id')->where('course_id', $enrollment->course_id)))
            ->with(['batch.course', 'course'])
            ->orderByDesc('released_at')
            ->get();

        return ApiResponse::collection($resources->map(fn (Resource $resource) => (new ResourceFileResource($resource))
            ->additional(['enrollment_id' => $enrollment->id])
            ->toArray($request)));
    }

    public function syllabus(Request $request, string $enrollmentId): JsonResponse
    {
        $enrollment = $this->find($request, $enrollmentId);

        $modules = SyllabusModule::query()
            ->where('course_id', $enrollment->course_id)
            ->with('lessons')
            ->ordered()
            ->get();

        $completed = LessonCompletion::query()
            ->where('user_id', $request->user()->getKey())
            ->whereNotNull('completed_at')
            ->pluck('syllabus_lesson_id')
            ->flip()
            ->map(fn () => true)
            ->all();

        return ApiResponse::collection($modules->map(fn (SyllabusModule $module) => (new SyllabusModuleResource($module))
            ->additional(['completed_lessons' => $completed])
            ->toArray($request)));
    }

    /**
     * Mark a lesson complete, or undo it.
     *
     * `lesson_completions` had a table, a model, a relation and a share of the
     * progress calculation — and nothing anywhere could write a row. Syllabus
     * progress was therefore permanently 0% for every student, and the tick
     * against each lesson could never appear.
     */
    public function completeLesson(Request $request, string $enrollmentId, string $lessonId): JsonResponse
    {
        $enrollment = $this->find($request, $enrollmentId);

        $data = $request->validate(['completed' => ['sometimes', 'boolean']]);
        $completed = $data['completed'] ?? true;

        // The lesson must belong to the course this enrolment is for, so a
        // crafted id cannot tick off another course's syllabus.
        $lesson = SyllabusLesson::query()
            ->whereKey($lessonId)
            ->whereHas('module', fn ($query) => $query->where('course_id', $enrollment->course_id))
            ->firstOrFail();

        LessonCompletion::updateOrCreate(
            [
                'user_id' => $request->user()->getKey(),
                'syllabus_lesson_id' => $lesson->getKey(),
            ],
            [
                'enrollment_id' => $enrollment->getKey(),
                'completed_at' => $completed ? now() : null,
            ],
        );

        // Progress feeds the course card and the dashboard, so it is
        // recalculated rather than left until the next nightly pass.
        $this->progress->recalculate($enrollment->fresh());

        return ApiResponse::item([
            'lesson_id' => $lesson->getKey(),
            'completed' => $completed,
            'syllabus_percent' => $this->progress->syllabusPercentFor($enrollment->fresh()),
        ]);
    }

    /**
     * The student's own attendance record for a batch.
     *
     * Attendance was recorded by teachers and surfaced to students only as a
     * single percentage on a progress bar. A student could see "68%" and had
     * no way to find out which classes they had missed, or to notice that a
     * class they attended had been marked absent.
     */
    public function attendance(Request $request, string $enrollmentId): JsonResponse
    {
        $enrollment = $this->find($request, $enrollmentId);

        $sessions = ClassSession::query()
            ->where('batch_id', $enrollment->batch_id)
            ->where('starts_at', '<', now())
            ->whereNotNull('attendance_finalized_at')
            ->orderByDesc('starts_at')
            ->limit(100)
            ->get();

        $records = Attendance::query()
            ->where('user_id', $request->user()->getKey())
            ->whereIn('class_session_id', $sessions->pluck('id'))
            ->get()
            ->keyBy('class_session_id');

        $rows = $sessions->map(function (ClassSession $session) use ($records) {
            $record = $records->get($session->getKey());

            return [
                'session_id' => $session->id,
                'topic' => $session->topic,
                'starts_at' => $session->starts_at->toIso8601String(),

                // No row on a finalised register means absent, which is what
                // the teacher's finalisation asserted.
                'status' => $record?->status->value ?? 'absent',
                'minutes_attended' => (int) ($record?->minutes_attended ?? 0),
                'note' => $record?->note,
            ];
        });

        $counted = $rows->count();
        $present = $rows->whereIn('status', ['present', 'late'])->count();

        return ApiResponse::item([
            'items' => $rows->values()->all(),
            'metrics' => [
                'finalized_classes' => $counted,
                'present' => $rows->where('status', 'present')->count(),
                'late' => $rows->where('status', 'late')->count(),
                'absent' => $rows->where('status', 'absent')->count(),
                'excused' => $rows->where('status', 'excused')->count(),
                'attendance_percent' => $counted > 0 ? (int) round($present / $counted * 100) : 0,
            ],
        ]);
    }

    public function tests(Request $request, string $enrollmentId): JsonResponse
    {
        $enrollment = $this->find($request, $enrollmentId);

        $tests = Test::query()
            ->where('batch_id', $enrollment->batch_id)
            ->visibleToStudents()
            ->with('course:id,title')
            ->orderByDesc('opens_at')
            ->get();

        $attempts = TestAttempt::query()
            ->where('user_id', $request->user()->getKey())
            ->whereIn('test_id', $tests->pluck('id'))
            ->selectRaw('test_id, count(*) as used, max(score) as best')
            ->groupBy('test_id')
            ->get()
            ->keyBy('test_id');

        return ApiResponse::collection($tests->map(fn (Test $test) => (new StudentTestResource($test))->additional([
            'enrollment_id' => $enrollment->id,
            'attempts_used' => (int) ($attempts[$test->id]->used ?? 0),
            'best_score' => $attempts[$test->id]->best ?? null,
        ])->toArray($request)));
    }

    public function announcements(Request $request, string $enrollmentId): JsonResponse
    {
        $enrollment = $this->find($request, $enrollmentId);

        $announcements = Announcement::query()
            ->published()
            ->forStudent([$enrollment->batch_id], [$enrollment->course_id])
            ->with(['course:id,title', 'batch.course:id,title'])
            ->orderByDesc('pinned')
            ->orderByDesc('published_at')
            ->get();

        return ApiResponse::collection(AnnouncementResource::collection($announcements));
    }

    /**
     * Self-enrolls the student in a free batch.
     *
     * Payment approval was the only activation path, which meant a course
     * marked free could not actually be joined. Nothing here trusts the client
     * about price: the course must genuinely be free on the server, and a paid
     * course sent to this endpoint is refused rather than quietly granted.
     */
    public function enrollFree(Request $request): JsonResponse
    {
        if (! $this->features->freeCourses()) {
            throw DomainException::conflict('Free enrollment is currently closed.', 'free_courses_disabled');
        }

        $data = $request->validate(['batch_id' => ['required', 'string']]);

        $batch = Batch::with('course')->findOrFail($data['batch_id']);
        $student = $request->user();

        if ($batch->course?->access_type !== AccessType::Free) {
            throw DomainException::forbidden(
                'This course requires payment. Submit your payment from the payments page.',
                'course_is_paid',
            );
        }

        if (! in_array($batch->status->value, ['open', 'ongoing'], true)) {
            throw DomainException::conflict('This batch is not accepting enrollments.', 'batch_closed');
        }

        if ($batch->isFull()) {
            throw DomainException::conflict('This batch is full.', 'batch_full');
        }

        $enrollment = DB::transaction(function () use ($student, $batch) {
            $existing = Enrollment::query()
                ->where('user_id', $student->getKey())
                ->where('batch_id', $batch->getKey())
                ->lockForUpdate()
                ->first();

            if ($existing !== null && $existing->grantsAccess()) {
                throw DomainException::conflict('You are already enrolled in this batch.', 'already_enrolled');
            }

            $attributes = [
                'status' => EnrollmentStatus::Active->value,
                'access_start_at' => now(),
                'access_end_at' => $batch->access_until ?? now()->addDays($this->settings->int('operations.default_access_days', 180)),
                'source' => 'free',
                'activated_at' => now(),
                'cancelled_at' => null,
                'cancellation_reason' => null,
            ];

            if ($existing !== null) {
                $existing->forceFill($attributes)->save();

                return $existing;
            }

            return Enrollment::create($attributes + [
                'user_id' => $student->getKey(),
                'course_id' => $batch->course_id,
                'batch_id' => $batch->getKey(),
            ]);
        });

        $this->audit->log('enrollment.free_self_service', $enrollment, $student);
        $this->notifications->enrollmentActivated($enrollment->load(['user', 'course']));

        return ApiResponse::item([
            'enrollment_id' => $enrollment->getKey(),
            'course_title' => $batch->course?->title,
        ], status: 201);
    }

    /* ----------------------------------------------------------------
     | Helpers
     | ---------------------------------------------------------------- */

    protected function scope(Request $request)
    {
        return Enrollment::query()->where('user_id', $request->user()->getKey())->accessible();
    }

    protected function find(Request $request, string $enrollmentId): Enrollment
    {
        return $this->scope($request)
            ->with(['course', 'batch'])
            ->whereKey($enrollmentId)
            ->firstOrFail();
    }

    protected function joinReason(ClassSession $session): string
    {
        return match (true) {
            $session->status->value === 'cancelled' => 'This class was cancelled',
            $session->status->value === 'completed' => 'This class has ended',
            $session->starts_at->isFuture() => 'Opens shortly before class',
            default => 'The join window has closed',
        };
    }
}
