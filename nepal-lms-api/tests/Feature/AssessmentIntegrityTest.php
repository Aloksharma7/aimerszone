<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\TestAttempt;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Everything that would let a student see or manufacture a mark they did not
 * earn.
 */
class AssessmentIntegrityTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_correct_answers_never_appear_in_a_student_attempt_payload(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);
        $test = $this->makeTest($batch);

        $response = $this->actingAs($student)
            ->postJson('/api/v1/student/tests/'.$test->getKey().'/attempts')
            ->assertCreated();

        $body = $response->getContent();

        $this->assertStringNotContainsString('is_correct', $body);
        $this->assertStringNotContainsString('explanation', $body);

        // The option text still ships — only its correctness is withheld.
        $this->assertStringContainsString('Right', $body);
    }

    public function test_a_student_cannot_open_an_attempt_for_a_batch_they_are_not_in(): void
    {
        $test = $this->makeTest($this->makeBatch($this->makeCourse()));
        $outsider = $this->makeUser(RoleKey::Student);
        $this->enroll($outsider, $this->makeBatch($this->makeCourse()));

        $this->actingAs($outsider)
            ->postJson('/api/v1/student/tests/'.$test->getKey().'/attempts')
            ->assertForbidden();
    }

    public function test_refreshing_mid_test_resumes_rather_than_consuming_an_attempt(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);
        $test = $this->makeTest($batch, ['attempts_allowed' => 1]);

        $first = $this->actingAs($student)
            ->postJson('/api/v1/student/tests/'.$test->getKey().'/attempts')
            ->assertCreated()
            ->json('data.id');

        $second = $this->actingAs($student)
            ->postJson('/api/v1/student/tests/'.$test->getKey().'/attempts')
            ->assertCreated()
            ->json('data.id');

        $this->assertSame($first, $second, 'A resumed attempt must be the same attempt.');
        $this->assertSame(1, TestAttempt::where('test_id', $test->getKey())->count());
    }

    public function test_an_expired_attempt_is_graded_from_what_was_autosaved(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);
        $test = $this->makeTest($batch);

        $attemptId = $this->actingAs($student)
            ->postJson('/api/v1/student/tests/'.$test->getKey().'/attempts')
            ->json('data.id');

        $question = $test->questions()->first();
        $correctOption = $question->options()->where('is_correct', true)->first();

        $this->actingAs($student)->patchJson('/api/v1/student/attempts/'.$attemptId.'/responses', [
            'answers' => [['question_id' => $question->getKey(), 'response' => $correctOption->getKey()]],
        ])->assertOk();

        // The server clock, not the browser, decides the deadline.
        TestAttempt::whereKey($attemptId)->update(['expires_at' => now()->subMinute()]);

        $this->artisan('lms:finalize-attempts')->assertSuccessful();

        $attempt = TestAttempt::find($attemptId);

        $this->assertSame('graded', $attempt->status->value);
        $this->assertTrue($attempt->auto_submitted);
        $this->assertEquals(2.0, (float) $attempt->score, 'Autosaved work must still be scored.');
    }

    public function test_a_result_is_withheld_until_the_release_policy_is_met(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);

        // Closes in the future, so "after_close" is not yet satisfied.
        $test = $this->makeTest($batch, ['result_release' => 'after_close', 'closes_at' => now()->addHours(2)]);

        $attemptId = $this->actingAs($student)
            ->postJson('/api/v1/student/tests/'.$test->getKey().'/attempts')
            ->json('data.id');

        $this->actingAs($student)
            ->postJson('/api/v1/student/attempts/'.$attemptId.'/submit')
            ->assertOk();

        $this->actingAs($student)
            ->getJson('/api/v1/student/attempts/'.$attemptId.'/result')
            ->assertOk()
            ->assertJsonPath('data.release_state', 'pending')
            ->assertJsonPath('data.score', null);
    }

    public function test_a_student_cannot_read_the_teacher_test_builder(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);
        $test = $this->makeTest($batch);

        $this->actingAs($student)
            ->getJson('/api/v1/teacher/tests/'.$test->getKey().'/builder')
            ->assertForbidden();
    }
}
