<?php

namespace Tests\Unit;

use App\Enums\RoleKey;
use App\Models\TestAttempt;
use App\Models\TestResponse;
use App\Services\AttemptGrader;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/** Scoring rules, including the edges that are easy to get wrong. */
class AttemptGraderTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    private function attemptWith(?bool $correct, array $testAttributes = []): TestAttempt
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $enrollment = $this->enroll($student, $batch);
        $test = $this->makeTest($batch, $testAttributes);

        $attempt = TestAttempt::create([
            'test_id' => $test->getKey(),
            'user_id' => $student->getKey(),
            'enrollment_id' => $enrollment->getKey(),
            'attempt_number' => 1,
            'status' => 'in_progress',
            'started_at' => now()->subMinutes(5),
            'expires_at' => now()->addMinutes(25),
        ]);

        if ($correct !== null) {
            $question = $test->questions()->first();
            $option = $question->options()->where('is_correct', $correct)->first();

            TestResponse::create([
                'test_attempt_id' => $attempt->getKey(),
                'test_question_id' => $question->getKey(),
                'selected_option_ids' => [$option->getKey()],
                'answered_at' => now(),
            ]);
        }

        return $attempt;
    }

    public function test_a_correct_answer_earns_full_marks(): void
    {
        $graded = app(AttemptGrader::class)->submit($this->attemptWith(true));

        $this->assertEquals(2.0, (float) $graded->score);
        $this->assertTrue($graded->passed);
    }

    public function test_an_unanswered_question_scores_zero_without_penalty(): void
    {
        $graded = app(AttemptGrader::class)->submit(
            $this->attemptWith(null, ['negative_marking' => 1]),
        );

        $this->assertEquals(0.0, (float) $graded->score);
    }

    public function test_negative_marking_never_drives_a_score_below_zero(): void
    {
        $graded = app(AttemptGrader::class)->submit(
            $this->attemptWith(false, ['negative_marking' => 5]),
        );

        $this->assertEquals(0.0, (float) $graded->score, 'A test is never scored lower than nothing.');
    }

    public function test_grading_is_idempotent(): void
    {
        $grader = app(AttemptGrader::class);
        $attempt = $this->attemptWith(true);

        $first = $grader->submit($attempt);
        $second = $grader->submit($first);

        $this->assertEquals((float) $first->score, (float) $second->score);
        $this->assertSame($first->graded_at->toIso8601String(), $second->graded_at->toIso8601String());
    }
}
