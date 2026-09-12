<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: there was no way to delete a test at all, draft or
 * published — TestController had store/update/publish/results and nothing
 * else. Mirrors the same rule publish() already enforces when sending a
 * test back to Draft: refused the moment a student has actually attempted
 * it, since deleting would erase a recorded score that publish() itself
 * already treats as untouchable.
 */
class TeacherTestDeletionTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_teacher_can_delete_a_test_with_no_attempts(): void
    {
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch = $this->makeBatch($this->makeCourse());
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);
        $test = $this->makeTest($batch);

        $this->actingAs($teacher)
            ->deleteJson("/api/v1/teacher/tests/{$test->id}")
            ->assertOk();

        $this->assertDatabaseMissing('tests', ['id' => $test->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'test.deleted', 'target_id' => $test->id]);
    }

    public function test_a_test_with_attempts_cannot_be_deleted(): void
    {
        $teacher = $this->makeUser(RoleKey::Teacher);
        $student = $this->makeUser(RoleKey::Student);
        $batch = $this->makeBatch($this->makeCourse());
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);
        $this->enroll($student, $batch);
        $test = $this->makeTest($batch);
        $test->attempts()->create([
            'user_id' => $student->getKey(),
            'attempt_number' => 1,
            'status' => 'submitted',
            'started_at' => now()->subMinutes(10),
            'expires_at' => now()->addMinutes(20),
            'submitted_at' => now(),
        ]);

        $response = $this->actingAs($teacher)->deleteJson("/api/v1/teacher/tests/{$test->id}");

        $response->assertStatus(409)->assertJsonPath('code', 'test_has_attempts');
        $this->assertDatabaseHas('tests', ['id' => $test->id]);
    }

    public function test_a_teacher_cannot_delete_a_test_from_a_batch_they_do_not_teach(): void
    {
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch = $this->makeBatch($this->makeCourse());
        $test = $this->makeTest($batch);

        $this->actingAs($teacher)
            ->deleteJson("/api/v1/teacher/tests/{$test->id}")
            ->assertForbidden();
    }
}
