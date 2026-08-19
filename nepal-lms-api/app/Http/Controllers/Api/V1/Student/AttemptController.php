<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Enums\AttemptStatus;
use App\Enums\QuestionType;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Test;
use App\Models\TestAttempt;
use App\Models\TestQuestion;
use App\Models\TestResponse;
use App\Services\AccessGuard;
use App\Services\AttemptGrader;
use App\Services\AuditLogger;
use App\Services\EnrollmentProgressService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The attempt lifecycle: start, autosave, submit, result.
 *
 * Three rules hold throughout:
 *   1. The deadline is stored server-side at creation; the browser's clock is
 *      only ever used to display a countdown.
 *   2. Correct answers and explanations never appear in any payload here.
 *   3. Submission is idempotent — a retried request returns the first result.
 */
class AttemptController extends Controller
{
    public function __construct(
        protected AccessGuard $guard,
        protected AttemptGrader $grader,
        protected EnrollmentProgressService $progress,
        protected AuditLogger $audit,
    ) {}

    public function store(Request $request, Test $test): JsonResponse
    {
        $this->authorize('attempt', $test);

        $user = $request->user();
        $enrollment = $this->guard->enrollmentFor($user, $test->batch_id);

        if ($enrollment === null) {
            throw DomainException::forbidden('Your access to this batch is not active.', 'enrollment_inactive');
        }

        $attempt = DB::transaction(function () use ($test, $user, $enrollment) {
            // Lock on the test row so two tabs cannot open two attempts at once.
            $locked = Test::whereKey($test->getKey())->lockForUpdate()->firstOrFail();

            $existing = TestAttempt::query()
                ->where('test_id', $locked->getKey())
                ->where('user_id', $user->getKey())
                ->orderByDesc('attempt_number')
                ->first();

            // An unfinished attempt is resumed rather than replaced, so a
            // refresh mid-test never costs the student an attempt.
            if ($existing !== null && $existing->isInProgress() && ! $existing->hasExpired()) {
                return $existing;
            }

            $used = TestAttempt::where('test_id', $locked->getKey())->where('user_id', $user->getKey())->count();

            if ($used >= $locked->attempts_allowed) {
                throw DomainException::conflict('You have used all attempts for this test.', 'attempts_exhausted');
            }

            $questionIds = $locked->questions()->pluck('id')->all();

            if ($locked->shuffle_questions) {
                shuffle($questionIds);
            }

            $startedAt = now();

            // The window closes at whichever comes first: the duration, or the
            // test's own closing time.
            $expiresAt = $startedAt->copy()->addMinutes($locked->duration_minutes);

            if ($locked->closes_at !== null && $locked->closes_at->lt($expiresAt) && ! $locked->allow_late_submission) {
                $expiresAt = $locked->closes_at->copy();
            }

            return TestAttempt::create([
                'test_id' => $locked->getKey(),
                'user_id' => $user->getKey(),
                'enrollment_id' => $enrollment->getKey(),
                'attempt_number' => $used + 1,
                'status' => AttemptStatus::InProgress->value,
                'started_at' => $startedAt,
                'expires_at' => $expiresAt,
                'question_order' => $questionIds,
                'ip_address' => request()->ip(),
            ]);
        });

        $this->audit->log('attempt.started', $attempt, $user);

        return ApiResponse::item($this->attemptPayload($attempt->fresh()), status: 201);
    }

    /** Autosave. Accepts partial answers and never grades anything. */
    public function saveResponses(Request $request, TestAttempt $attempt): JsonResponse
    {
        $this->assertOwned($request, $attempt);

        $data = $request->validate([
            'answers' => ['required', 'array', 'max:300'],
            'answers.*.question_id' => ['required', 'string'],

            /*
             * Multi-answer questions need more than one option id, so the
             * runner may send an array. A string is still accepted for single
             * choice, true/false and short text.
             */
            'answers.*.response' => ['nullable'],
            'answers.*.response.*' => ['string', 'max:5000'],
            'flagged_question_ids' => ['nullable', 'array', 'max:300'],
            'flagged_question_ids.*' => ['string'],
            'client_sequence' => ['nullable', 'integer'],
        ]);

        if (! $attempt->isInProgress()) {
            throw DomainException::conflict('This attempt has already been submitted.', 'attempt_closed');
        }

        if ($attempt->hasExpired()) {
            // Grade what was saved rather than discarding the student's work.
            $this->grader->submit($attempt, autoSubmitted: true);

            throw DomainException::conflict('Time is up — this attempt was submitted automatically.', 'attempt_expired');
        }

        $questions = $attempt->test->questions()->with('options:id,test_question_id')->get()->keyBy('id');
        $flagged = collect($data['flagged_question_ids'] ?? [])->flip();

        DB::transaction(function () use ($data, $attempt, $questions, $flagged) {
            foreach ($data['answers'] as $answer) {
                $question = $questions->get($answer['question_id']);

                // Silently ignore ids that are not part of this paper.
                if ($question === null) {
                    continue;
                }

                TestResponse::updateOrCreate(
                    ['test_attempt_id' => $attempt->getKey(), 'test_question_id' => $question->getKey()],
                    $this->responseAttributes($question, $answer['response'] ?? null, $flagged->has($question->getKey())),
                );
            }
        });

        return ApiResponse::item([
            'saved_at' => now()->toIso8601String(),
            'seconds_remaining' => $attempt->secondsRemaining(),
        ]);
    }

    public function submit(Request $request, TestAttempt $attempt): JsonResponse
    {
        $this->assertOwned($request, $attempt);

        $request->validate([
            'automatic' => ['nullable', 'boolean'],
            'client_submitted_at' => ['nullable', 'date'],
        ]);

        // Already submitted: return the same answer instead of erroring, so a
        // retry after a dropped connection is harmless.
        if (! $attempt->isInProgress()) {
            return ApiResponse::item([
                'attempt_id' => $attempt->id,
                'result_path' => '/student/attempts/'.$attempt->id,
            ]);
        }

        $attempt->forceFill(['submitted_at' => now()])->save();
        $graded = $this->grader->submit($attempt, autoSubmitted: $request->boolean('automatic'));

        $enrollment = $this->guard->enrollmentFor($request->user(), $graded->test->batch_id);

        if ($enrollment !== null) {
            $this->progress->recalculate($enrollment);
        }

        $this->audit->log('attempt.submitted', $graded, $request->user(), properties: [
            'auto' => $request->boolean('automatic'),
        ]);

        return ApiResponse::item([
            'attempt_id' => $graded->id,
            'result_path' => '/student/attempts/'.$graded->id,
        ]);
    }

    /**
     * The result screen. When the test's release policy has not been met the
     * score is withheld and the state reads "pending" — the mark is not sent
     * and simply hidden client-side.
     */
    public function result(Request $request, TestAttempt $attempt): JsonResponse
    {
        $this->assertOwned($request, $attempt);

        $test = $attempt->test()->with('questions')->firstOrFail();
        $released = $test->resultsAreReleased() && $attempt->status === AttemptStatus::Graded;

        $responses = $attempt->responses()->get();
        $answered = $responses->filter(fn (TestResponse $response) => filled($response->selected_option_ids) || filled($response->text_answer));

        $used = TestAttempt::where('test_id', $test->getKey())->where('user_id', $request->user()->getKey())->count();
        $remaining = max(0, $test->attempts_allowed - $used);

        return ApiResponse::item([
            'id' => $attempt->id,
            'title' => $test->title,
            'course_title' => $test->course?->title,
            'submitted_at' => $attempt->submitted_at?->toIso8601String(),
            'release_state' => $released ? 'released' : 'pending',
            'score' => $released ? (float) $attempt->score : null,
            'total_marks' => (int) $test->total_marks,
            'pass_marks' => (int) $test->pass_mark,
            'correct' => $released ? $responses->where('is_correct', true)->count() : null,
            'incorrect' => $released ? $answered->where('is_correct', false)->count() : null,
            'unanswered' => $released ? max(0, $test->questions->count() - $answered->count()) : null,
            'time_used_seconds' => $attempt->submitted_at
                ? $attempt->started_at->diffInSeconds($attempt->submitted_at)
                : null,
            'attempts_remaining' => $remaining,
            'reattempt_test_id' => $remaining > 0 && $test->isOpenNow() ? $test->id : null,
            'topic_performance' => [],
        ]);
    }

    /* ----------------------------------------------------------------
     | Helpers
     | ---------------------------------------------------------------- */

    protected function assertOwned(Request $request, TestAttempt $attempt): void
    {
        abort_unless($attempt->user_id === $request->user()->getKey(), 404);
    }

    /**
     * The frontend sends one string per question: an option id for multiple
     * choice, free text for short answer.
     */
    protected function responseAttributes(TestQuestion $question, mixed $response, bool $flagged): array
    {
        $isText = $question->type === QuestionType::ShortText;

        if ($isText) {
            $text = is_array($response) ? (string) reset($response) : $response;
            $text = is_string($text) ? $text : null;

            return [
                'selected_option_ids' => null,
                'text_answer' => $text,
                'answered_at' => filled($text) ? now() : null,
                'flagged' => $flagged,
                'is_correct' => null,
                'awarded_marks' => null,
            ];
        }

        /*
         * A single-answer question keeps exactly one id even if the client
         * sends more; a multi-answer question keeps the whole set. Only ids
         * belonging to this question survive, so a crafted payload cannot
         * reference another paper's options.
         */
        $valid = $question->options->pluck('id')->all();

        $selected = collect(is_array($response) ? $response : [$response])
            ->filter(fn ($id) => is_string($id) && in_array($id, $valid, true))
            ->unique()
            ->values();

        if ($question->type !== QuestionType::Multiple) {
            $selected = $selected->take(1);
        }

        return [
            'selected_option_ids' => $selected->isEmpty() ? null : $selected->all(),
            'text_answer' => null,
            'answered_at' => $selected->isEmpty() ? null : now(),
            'flagged' => $flagged,

            // Scores are only ever written by the grader.
            'is_correct' => null,
            'awarded_marks' => null,
        ];
    }

    /**
     * Builds the attempt payload for the runner.
     * Options are shipped without any hint of correctness.
     */
    protected function attemptPayload(TestAttempt $attempt): array
    {
        $test = $attempt->test()->with(['questions.options', 'course:id,title'])->firstOrFail();
        $responses = $attempt->responses()->get()->keyBy('test_question_id');

        $order = collect($attempt->question_order ?? []);
        $questions = $test->questions
            ->sortBy(fn (TestQuestion $question) => $order->search($question->id) === false ? 999 : $order->search($question->id))
            ->values();

        return [
            'id' => $attempt->id,
            'test_id' => $test->id,
            'title' => $test->title,
            'course_title' => $test->course?->title,
            'total_marks' => (int) $test->total_marks,
            'duration_seconds' => $attempt->secondsRemaining(),
            'started_at' => $attempt->started_at->toIso8601String(),
            'expires_at' => $attempt->expires_at->toIso8601String(),

            // The runner corrects for clock skew against this value.
            'server_now' => now()->toIso8601String(),

            'attempt_number' => (int) $attempt->attempt_number,
            'attempts_allowed' => (int) $test->attempts_allowed,
            'questions' => $questions->map(function (TestQuestion $question, int $index) use ($responses, $test) {
                $response = $responses->get($question->getKey());
                $isText = $question->type === QuestionType::ShortText;
                $options = $question->options->sortBy('order');

                if ($test->shuffle_options && ! $isText) {
                    $options = $options->shuffle();
                }

                /*
                 * The real question type is sent through. Collapsing every
                 * choice question to "multiple_choice" made the runner render
                 * a radio group for multi-answer papers, so those questions
                 * could not be answered correctly and were then penalised.
                 */
                return [
                    'id' => $question->id,
                    'order' => $index + 1,
                    'type' => $question->type->value,
                    'prompt' => $question->prompt,
                    'marks' => (float) $question->marks,
                    'options' => $isText ? [] : $options->values()->map(fn ($option, $position) => [
                        'id' => $option->id,
                        'label' => chr(65 + $position),
                        'text' => $option->label,
                    ])->all(),
                    'response' => $isText
                        ? $response?->text_answer
                        : (($response?->selected_option_ids ?? [])[0] ?? null),
                    'responses' => $isText ? [] : ($response?->selected_option_ids ?? []),
                    'flagged' => (bool) $response?->flagged,
                ];
            })->all(),
        ];
    }
}
