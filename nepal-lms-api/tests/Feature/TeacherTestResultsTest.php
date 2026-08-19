<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\TestAttempt;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: teachers could author, publish and see submission counts for a
 * test, but there was no endpoint anywhere that returned who scored what —
 * grading happened, but the only place the result ever surfaced was the
 * student's own attempt screen.
 */
class TeacherTestResultsTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_teacher_can_see_graded_results_for_their_own_test(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $student = $this->makeUser(RoleKey::Student);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);
        $enrollment = $this->enroll($student, $batch);

        $test = $this->makeTest($batch, ['total_marks' => 10, 'pass_mark' => 5]);

        TestAttempt::create([
            'test_id' => $test->getKey(),
            'user_id' => $student->getKey(),
            'enrollment_id' => $enrollment->getKey(),
            'attempt_number' => 1,
            'status' => 'graded',
            'started_at' => now()->subMinutes(30),
            'expires_at' => now()->subMinutes(10),
            'submitted_at' => now()->subMinutes(12),
            'graded_at' => now()->subMinutes(11),
            'score' => 8,
            'max_score' => 10,
            'passed' => true,
        ]);

        $response = $this->actingAs($teacher)
            ->getJson('/api/v1/teacher/tests/'.$test->getKey().'/results')
            ->assertOk();

        $response->assertJsonPath('data.metrics.submissions', 1)
            ->assertJsonPath('data.metrics.graded', 1)
            ->assertJsonPath('data.metrics.passed', 1)
            ->assertJsonPath('data.attempts.0.student_name', $student->name)
            ->assertJsonPath('data.attempts.0.score', 8)
            ->assertJsonPath('data.attempts.0.passed', true);
    }

    public function test_a_teacher_cannot_see_results_for_a_test_they_do_not_teach(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $other = $this->makeUser(RoleKey::Teacher);
        $test = $this->makeTest($batch);

        $this->actingAs($other)
            ->getJson('/api/v1/teacher/tests/'.$test->getKey().'/results')
            ->assertForbidden();
    }
}
