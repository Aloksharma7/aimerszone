<?php

namespace App\Http\Controllers\Api\V1\Teacher;

use App\Enums\QuestionType;
use App\Enums\TestStatus;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Test;
use App\Models\TestAttempt;
use App\Models\TestOption;
use App\Models\TestQuestion;
use App\Services\AccessGuard;
use App\Services\AuditLogger;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Test authoring.
 *
 * The builder endpoint is the single place in the API that returns is_correct
 * and explanations, and it is gated by TestPolicy::viewBuilder — assigned
 * teacher or administrator only.
 */
class TestController extends Controller
{
    use ResolvesTeacherScope;

    public function __construct(
        protected AccessGuard $guard,
        protected SettingsRepository $settings,
        protected AuditLogger $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tests = Test::query()
            ->whereIn('batch_id', $this->guard->taughtBatchIds($request->user()) ?: ['-'])
            ->withCount(['attempts as submissions_count' => fn ($query) => $query->whereIn('status', ['submitted', 'graded'])])
            ->orderByDesc('created_at')
            ->paginate($this->perPage(100));

        return ApiResponse::paginated($tests, fn (Test $test) => $this->summary($test));
    }

    public function forBatch(Request $request, string $batchId): JsonResponse
    {
        $batch = $this->resolveBatch($batchId, $request->user());

        $tests = Test::query()
            ->where('batch_id', $batch->getKey())
            ->withCount(['attempts as submissions_count' => fn ($query) => $query->whereIn('status', ['submitted', 'graded'])])
            ->orderByDesc('created_at')
            ->get();

        return ApiResponse::collection($tests->map(fn (Test $test) => $this->summary($test)));
    }

    /** Defaults and the batch list for the "create test" screen. */
    public function newContext(Request $request): JsonResponse
    {
        /*
         * Field names here must match the builder() payload exactly: the same
         * frontend mapper reads both, so a `title` here and a `batch_title`
         * there produced "Course · undefined" in the selector.
         */
        return ApiResponse::item([
            'id' => null,
            'status' => 'draft',
            'batch_id' => $request->string('batch_id')->value() ?: null,
            'title' => null,
            'opens_at' => null,
            'closes_at' => null,
            'duration_minutes' => $this->settings->int('assessment.default_duration_minutes', 45),
            'attempts_allowed' => $this->settings->int('assessment.default_attempts_allowed', 1),
            'pass_mark' => 0,
            'total_marks' => 0,
            'shuffle_questions' => false,
            'shuffle_options' => false,
            'negative_marking' => 0,
            'result_release' => 'after_close',
            'has_attempts' => false,
            'questions' => [],
            'batches' => $this->assignableBatches($request)->all(),
            'defaults' => [
                'duration_minutes' => $this->settings->int('assessment.default_duration_minutes', 45),
                'attempts_allowed' => $this->settings->int('assessment.default_attempts_allowed', 1),
                'pass_percent' => $this->settings->int('assessment.default_pass_percent', 40),
                'result_release' => 'after_close',
            ],
        ]);
    }

    /**
     * Batches this user may attach a test to, in the shape the builder screen
     * expects. Administrators are not teachers of any batch, so they fall back
     * to the full list rather than getting an empty selector.
     */
    protected function assignableBatches(Request $request)
    {
        $user = $request->user();
        $batchIds = $this->guard->taughtBatchIds($user);

        $query = Batch::query()->with('course:id,title');

        if (! $user->isAdmin()) {
            $query->whereIn('id', $batchIds ?: ['-']);
        }

        return $query->get()->map(fn (Batch $batch) => [
            'id' => $batch->id,
            'batch_title' => $batch->title,
            'course_title' => $batch->course?->title ?? 'Course removed',
        ])->values();
    }

    /** Full paper including correct answers. Teacher/admin only. */
    public function builder(Request $request, Test $test): JsonResponse
    {
        $this->authorize('viewBuilder', $test);

        $test->load(['questions.options', 'batch.course']);

        return ApiResponse::item([
            'id' => $test->id,
            'batch_id' => $test->batch_id,
            'batch_title' => $test->batch?->title,
            'course_title' => $test->batch?->course?->title,
            'title' => $test->title,
            'instructions' => $test->instructions,
            'status' => $test->status->value,
            'opens_at' => $test->opens_at?->toIso8601String(),
            'closes_at' => $test->closes_at?->toIso8601String(),
            'duration_minutes' => (int) $test->duration_minutes,
            'attempts_allowed' => (int) $test->attempts_allowed,
            'pass_mark' => (int) $test->pass_mark,
            'total_marks' => (int) $test->total_marks,
            'shuffle_questions' => (bool) $test->shuffle_questions,
            'shuffle_options' => (bool) $test->shuffle_options,
            'negative_marking' => (float) $test->negative_marking,
            'result_release' => $test->result_release,
            'has_attempts' => $test->attempts()->exists(),

            // Publishing is the assigned teacher's own act, not just anyone
            // holding tests.manage — an admin viewing this same builder needs
            // to know before it renders a button the endpoint will refuse.
            'can_publish' => (bool) $request->user()?->can('publish', $test),
            'questions' => $test->questions->sortBy('order')->values()->map(fn (TestQuestion $question) => [
                'id' => $question->id,
                'order' => (int) $question->order,
                'type' => $question->type->value,
                'prompt' => $question->prompt,
                'marks' => (float) $question->marks,
                'explanation' => $question->explanation,
                'accepted_answers' => $question->accepted_answers ?? [],
                'options' => $question->options->sortBy('order')->values()->map(fn (TestOption $option) => [
                    'id' => $option->id,
                    'label' => $option->label,
                    'is_correct' => (bool) $option->is_correct,
                ])->all(),
            ])->values()->all(),

            /*
             * The builder screen renders a batch selector from this list. It
             * was absent, so mapBuilder() dereferenced undefined and the whole
             * "edit test" page threw before it could paint.
             */
            'batches' => $this->assignableBatches($request)->all(),
        ])->header('Cache-Control', 'no-store, private');
    }

    /**
     * Per-student outcomes for a test the teacher runs.
     *
     * Teachers could author and publish tests but never see how a class
     * actually performed on one — grading happened, but the only place the
     * result surfaced was the student's own attempt screen.
     */
    public function results(Request $request, Test $test): JsonResponse
    {
        $this->authorize('manage', $test);

        $attempts = TestAttempt::query()
            ->where('test_id', $test->getKey())
            ->whereIn('status', ['submitted', 'graded'])
            ->with('user:id,name,student_code')
            ->orderByDesc('submitted_at')
            ->get();

        $graded = $attempts->where('status', 'graded');

        return ApiResponse::item([
            'test' => ['id' => $test->id, 'title' => $test->title, 'total_marks' => (int) $test->total_marks, 'pass_mark' => (int) $test->pass_mark],
            'metrics' => [
                'submissions' => $attempts->count(),
                'graded' => $graded->count(),
                'passed' => $graded->where('passed', true)->count(),
                'average_score' => $graded->count() ? round((float) $graded->avg('score'), 2) : null,
            ],
            'attempts' => $attempts->map(fn (TestAttempt $attempt) => [
                'id' => $attempt->id,
                'student_name' => $attempt->user?->name ?? 'Removed account',
                'student_code' => $attempt->user?->student_code,
                'attempt_number' => (int) $attempt->attempt_number,
                'status' => $attempt->status->value,
                'score' => $attempt->score !== null ? (float) $attempt->score : null,
                'max_score' => (float) $attempt->max_score,
                'passed' => $attempt->passed,
                'submitted_at' => $attempt->submitted_at?->toIso8601String(),
                'auto_submitted' => (bool) $attempt->auto_submitted,
            ])->values()->all(),
        ]);
    }

    /**
     * Fires a "manual" release policy — the only release strategy that has no
     * other trigger anywhere in the app. "immediate" and "after_close" both
     * compute resultsAreReleased() straight from the test's own fields, but
     * "manual" falls back to comparing against results_released_at, and
     * nothing ever wrote to that column: a teacher who picked "Manual
     * release" in the builder had chosen a setting that could never actually
     * release anything, permanently withholding every student's score.
     */
    public function releaseResults(Request $request, Test $test): JsonResponse
    {
        $this->authorize('manage', $test);

        if ($test->result_release !== 'manual') {
            throw DomainException::conflict(
                'This test releases results automatically and does not need a manual trigger.',
                'not_manual_release',
            );
        }

        if ($test->results_released_at !== null) {
            throw DomainException::conflict('Results were already released.', 'already_released');
        }

        $test->forceFill(['results_released_at' => now()])->save();

        $this->audit->log('test.results_released', $test, $request->user());

        return ApiResponse::item(['results_released_at' => $test->results_released_at->toIso8601String()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, creating: true);

        $batch = $this->resolveBatch($data['batch_id'], $request->user());

        $test = Test::create(array_merge($this->attributes($data), [
            'batch_id' => $batch->getKey(),
            'course_id' => $batch->course_id,
            'status' => TestStatus::Draft->value,
            'created_by' => $request->user()->getKey(),
        ]));

        if (isset($data['questions'])) {
            $this->syncQuestions($test, $data['questions']);
        }

        $this->audit->log('test.created', $test, $request->user());

        return ApiResponse::item(['id' => $test->id], status: 201);
    }

    public function update(Request $request, Test $test): JsonResponse
    {
        $this->authorize('manage', $test);

        $data = $this->validated($request, creating: false);

        // Once students have attempted, changing the questions would invalidate
        // scores already awarded. Scheduling and release policy stay editable.
        if ($test->attempts()->exists() && isset($data['questions'])) {
            throw DomainException::conflict(
                'This test already has attempts, so its questions can no longer be changed.',
                'test_has_attempts',
            );
        }

        // A grader attempt's `passed` flag is computed once, at grading time,
        // against whatever pass_mark was live then, and never revisited. A
        // pass_mark edit after attempts exist left every already-graded
        // attempt's frozen pass/fail verdict silently contradicting the new
        // number shown right next to it on the results page. Checked against
        // the stored value, not mere presence in the payload, since the
        // frontend resubmits the full form for edits (like the schedule)
        // that must stay allowed even with attempts already recorded.
        if ($test->attempts()->exists() && isset($data['pass_mark']) && (int) $data['pass_mark'] !== (int) $test->pass_mark) {
            throw DomainException::conflict(
                'This test already has attempts, so its pass mark can no longer be changed.',
                'test_has_attempts',
            );
        }

        DB::transaction(function () use ($test, $data) {
            $test->fill($this->attributes($data))->save();

            if (isset($data['questions'])) {
                $this->syncQuestions($test, $data['questions']);
            }
        });

        $this->audit->log('test.updated', $test, $request->user());

        return ApiResponse::item(['id' => $test->id]);
    }

    /** Publishing makes the paper visible; it refuses an empty test. */
    public function publish(Request $request, Test $test): JsonResponse
    {
        $this->authorize('publish', $test);

        $request->validate(['publish' => ['nullable', 'boolean']]);

        if ($request->boolean('publish', true)) {
            if ($test->questions()->count() === 0) {
                throw DomainException::conflict('Add at least one question before publishing.', 'test_empty');
            }

            $marks = (float) $test->questions()->sum('marks');

            $test->forceFill([
                'status' => TestStatus::Open->value,
                'total_marks' => (int) round($marks),
                'published_at' => $test->published_at ?? now(),
            ])->save();
        } else {
            if ($test->attempts()->exists()) {
                throw DomainException::conflict(
                    'Students have already attempted this test, so it cannot be returned to draft.',
                    'test_has_attempts',
                );
            }

            $test->forceFill(['status' => TestStatus::Draft->value])->save();
        }

        $this->audit->log('test.'.($request->boolean('publish', true) ? 'published' : 'unpublished'), $test, $request->user());

        return ApiResponse::item(['status' => $test->fresh()->status->value]);
    }

    /* ----------------------------------------------------------------
     | Helpers
     | ---------------------------------------------------------------- */

    protected function summary(Test $test): array
    {
        return [
            'id' => $test->id,
            'title' => $test->title,
            'opens_at' => $test->opens_at?->toIso8601String(),
            'closes_at' => $test->closes_at?->toIso8601String(),
            'duration_minutes' => (int) $test->duration_minutes,
            'submissions_count' => (int) ($test->submissions_count ?? 0),
            'attempts_allowed' => (int) $test->attempts_allowed,
            'status' => $test->status->value,
        ];
    }

    protected function attributes(array $data): array
    {
        return collect($data)->only([
            'title', 'instructions', 'opens_at', 'closes_at', 'duration_minutes',
            'attempts_allowed', 'pass_mark', 'shuffle_questions', 'shuffle_options',
            'negative_marking', 'result_release', 'allow_late_submission',
        ])->all();
    }

    protected function validated(Request $request, bool $creating): array
    {
        return $request->validate([
            'batch_id' => [$creating ? 'required' : 'prohibited', 'string'],
            'title' => [$creating ? 'required' : 'sometimes', 'string', 'min:3', 'max:180'],
            'instructions' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'opens_at' => ['sometimes', 'nullable', 'date'],
            'closes_at' => ['sometimes', 'nullable', 'date', 'after:opens_at'],
            'duration_minutes' => ['sometimes', 'integer', 'min:1', 'max:600'],
            'attempts_allowed' => ['sometimes', 'integer', 'min:1', 'max:10'],
            'pass_mark' => ['sometimes', 'integer', 'min:0', 'max:1000'],
            'shuffle_questions' => ['sometimes', 'boolean'],
            'shuffle_options' => ['sometimes', 'boolean'],
            'negative_marking' => ['sometimes', 'numeric', 'min:0', 'max:10'],
            'result_release' => ['sometimes', Rule::in(['immediate', 'after_close', 'manual'])],
            'allow_late_submission' => ['sometimes', 'boolean'],

            'questions' => ['sometimes', 'array', 'max:200'],
            'questions.*.type' => ['required', Rule::in(QuestionType::values())],
            'questions.*.prompt' => ['required', 'string', 'min:3', 'max:5000'],
            'questions.*.marks' => ['required', 'numeric', 'min:0.5', 'max:100'],
            'questions.*.explanation' => ['nullable', 'string', 'max:2000'],
            'questions.*.options' => ['required_unless:questions.*.type,short_text', 'array', 'max:10'],
            'questions.*.options.*.label' => ['required', 'string', 'max:1000'],
            'questions.*.options.*.is_correct' => ['required', 'boolean'],

            // A short-text question with no answer key cannot be scored, so it
            // is required rather than optional.
            'questions.*.accepted_answers' => ['required_if:questions.*.type,short_text', 'array', 'max:20'],
            'questions.*.accepted_answers.*' => ['required', 'string', 'max:500'],
        ]);
    }

    /**
     * Replaces the paper wholesale. Safe because update() refuses to touch
     * questions once any attempt exists.
     */
    protected function syncQuestions(Test $test, array $questions): void
    {
        $test->questions()->delete();

        $total = 0.0;

        foreach ($questions as $index => $payload) {
            $type = QuestionType::from($payload['type']);

            $options = collect($payload['options'] ?? []);

            // A gradeable choice question needs exactly one correct answer for
            // single/true-false, and at least one for multiple.
            $accepted = collect($payload['accepted_answers'] ?? [])
                ->map(fn ($answer) => trim((string) $answer))
                ->filter()
                ->unique()
                ->values();

            if ($type !== QuestionType::ShortText) {
                $correct = $options->where('is_correct', true)->count();

                if ($correct === 0) {
                    throw DomainException::unprocessable(
                        'Question '.($index + 1).' has no correct answer marked.',
                        'question_without_answer',
                    );
                }

                if ($correct > 1 && $type !== QuestionType::Multiple) {
                    throw DomainException::unprocessable(
                        'Question '.($index + 1).' has more than one correct answer but is not a multiple-answer question.',
                        'question_answer_mismatch',
                    );
                }

                if ($type === QuestionType::TrueFalse && $options->count() !== 2) {
                    throw DomainException::unprocessable(
                        'Question '.($index + 1).' is true/false and must have exactly two options.',
                        'question_option_count',
                    );
                }
            } elseif ($accepted->isEmpty()) {
                throw DomainException::unprocessable(
                    'Question '.($index + 1).' is short text and has no accepted answer, so it could never be scored.',
                    'question_without_answer',
                );
            }

            $question = TestQuestion::create([
                'test_id' => $test->getKey(),
                'order' => $index,
                'type' => $type->value,
                'prompt' => $payload['prompt'],
                'marks' => $payload['marks'],
                'explanation' => $payload['explanation'] ?? null,
                'accepted_answers' => $type === QuestionType::ShortText ? $accepted->all() : null,
            ]);

            foreach ($options as $position => $option) {
                TestOption::create([
                    'test_question_id' => $question->getKey(),
                    'order' => $position,
                    'label' => $option['label'],
                    'is_correct' => (bool) $option['is_correct'],
                ]);
            }

            $total += (float) $payload['marks'];
        }

        $test->forceFill(['total_marks' => (int) round($total)])->save();
    }
}
