<?php

namespace App\Services;

use App\Enums\AttemptStatus;
use App\Enums\QuestionType;
use App\Models\Test;
use App\Models\TestAttempt;
use App\Models\TestQuestion;
use App\Models\TestResponse;
use Illuminate\Support\Facades\DB;

/**
 * Scoring engine for test attempts.
 *
 * Grading is server-side and idempotent: submitting an already-submitted
 * attempt returns the existing result rather than scoring it twice. The client
 * never sends a score, and correct answers never leave this class except
 * through the teacher builder endpoints.
 */
class AttemptGrader
{
    /**
     * Close and grade an attempt.
     *
     * @param  bool  $autoSubmitted  True when the scheduler closed it, not the student.
     */
    public function submit(TestAttempt $attempt, bool $autoSubmitted = false): TestAttempt
    {
        if (! $attempt->isInProgress()) {
            return $attempt;
        }

        return DB::transaction(function () use ($attempt, $autoSubmitted) {
            // Re-read under a lock so two concurrent submits cannot both grade.
            $locked = TestAttempt::whereKey($attempt->getKey())->lockForUpdate()->firstOrFail();

            if (! $locked->isInProgress()) {
                return $locked;
            }

            $test = $locked->test()->with('questions.options')->firstOrFail();
            $responses = $locked->responses()->get()->keyBy('test_question_id');

            $score = 0.0;
            $maxScore = 0.0;

            foreach ($test->questions as $question) {
                $maxScore += (float) $question->marks;
                $response = $responses->get($question->getKey());

                if ($response === null) {
                    continue;
                }

                $awarded = $this->scoreResponse($question, $response, $test);
                $score += $awarded;

                $response->forceFill([
                    'is_correct' => $awarded > 0,
                    'awarded_marks' => $awarded,
                ])->save();
            }

            // Negative marking can drive a paper below zero; a test is never
            // scored lower than nothing.
            $score = max(0, $score);
            $passed = $test->pass_mark > 0 ? $score >= $test->pass_mark : null;

            $locked->forceFill([
                'status' => AttemptStatus::Graded->value,
                'submitted_at' => $locked->submitted_at ?? now(),
                'graded_at' => now(),
                'score' => $score,
                'max_score' => $maxScore,
                'passed' => $passed,
                'auto_submitted' => $autoSubmitted,
            ])->save();

            return $locked;
        });
    }

    /** Marks for one answered question, including negative marking. */
    protected function scoreResponse(TestQuestion $question, TestResponse $response, Test $test): float
    {
        $correctIds = $question->correctOptionIds();

        $awarded = match ($question->type) {
            QuestionType::Single, QuestionType::TrueFalse => $this->scoreSingle($response, $correctIds, $question),
            QuestionType::Multiple => $this->scoreMultiple($response, $correctIds, $question),
            QuestionType::ShortText => $this->scoreShortText($response, $question),
        };

        if ($awarded > 0) {
            return $awarded;
        }

        /*
         * Negative marking applies to objective questions only.
         *
         * Short text is matched against a hand-written answer key, so a near
         * miss ("0.5" against "0.50") is as likely to be the key's fault as the
         * student's. Penalising it would mean a student who writes an answer
         * scores below one who leaves the box empty.
         */
        if ($question->type === QuestionType::ShortText) {
            return 0.0;
        }

        $penalty = (float) $question->negative_marks ?: (float) $test->negative_marking;

        return $this->wasAnswered($response) ? -$penalty : 0.0;
    }

    /**
     * Exact match against the accepted answers, after case-folding and
     * whitespace collapsing. A question with no key scores nothing rather than
     * failing the whole submission.
     */
    protected function scoreShortText(TestResponse $response, TestQuestion $question): float
    {
        $accepted = $question->acceptedAnswerSet();

        if ($accepted === [] || blank($response->text_answer)) {
            return 0.0;
        }

        $given = TestQuestion::normalizeAnswer((string) $response->text_answer);

        return in_array($given, $accepted, true) ? (float) $question->marks : 0.0;
    }

    protected function scoreSingle(TestResponse $response, array $correctIds, TestQuestion $question): float
    {
        $selected = $response->selected_option_ids ?? [];

        if (count($selected) !== 1) {
            return 0.0;
        }

        return in_array($selected[0], $correctIds, true) ? (float) $question->marks : 0.0;
    }

    /** All-or-nothing: every correct option and no incorrect ones. */
    protected function scoreMultiple(TestResponse $response, array $correctIds, TestQuestion $question): float
    {
        $selected = array_values(array_unique($response->selected_option_ids ?? []));

        if ($selected === []) {
            return 0.0;
        }

        sort($selected);
        sort($correctIds);

        return $selected === $correctIds ? (float) $question->marks : 0.0;
    }

    protected function wasAnswered(TestResponse $response): bool
    {
        return filled($response->selected_option_ids) || filled($response->text_answer);
    }
}
