<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: archiving or suspending a teacher checked nothing about the
 * batches they teach — only a student's own active enrollments were
 * guarded. The sole teacher of a live batch being archived or suspended
 * could silently make every class in it unstartable and its attendance
 * unmarkable (ClassSessionPolicy::start()/finalizeAttendance() don't fall
 * back to admin, unlike manage() — starting a class and attesting
 * attendance are deliberately the assigned teacher's own acts), with
 * nothing surfacing that to an admin.
 */
class TeacherOrphanedBatchTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_archiving_the_sole_teacher_of_an_open_batch_is_refused(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch = $this->makeBatch($this->makeCourse());
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $this->actingAs($admin)
            ->deleteJson('/api/v1/admin/users/'.$teacher->getKey())
            ->assertStatus(409)
            ->assertJsonPath('code', 'user_is_sole_batch_teacher');

        $this->assertSame('active', $teacher->fresh()->status->value);
    }

    public function test_suspending_the_sole_teacher_of_an_open_batch_is_refused(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch = $this->makeBatch($this->makeCourse());
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/users/'.$teacher->getKey().'/actions/suspend', ['reason' => 'Policy violation.'])
            ->assertStatus(409)
            ->assertJsonPath('code', 'user_is_sole_batch_teacher');
    }

    public function test_archiving_one_of_two_teachers_on_a_batch_is_allowed(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $teacherOne = $this->makeUser(RoleKey::Teacher);
        $teacherTwo = $this->makeUser(RoleKey::Teacher);
        $batch = $this->makeBatch($this->makeCourse());
        $batch->teachers()->attach($teacherOne->getKey(), ['is_lead' => true]);
        $batch->teachers()->attach($teacherTwo->getKey(), ['is_lead' => false]);

        $this->actingAs($admin)
            ->deleteJson('/api/v1/admin/users/'.$teacherOne->getKey())
            ->assertOk();
    }

    public function test_archiving_a_teacher_of_a_closed_batch_is_allowed(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch = $this->makeBatch($this->makeCourse(), ['status' => 'closed']);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $this->actingAs($admin)
            ->deleteJson('/api/v1/admin/users/'.$teacher->getKey())
            ->assertOk();
    }

    public function test_a_batch_cannot_be_saved_with_zero_teachers(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch = $this->makeBatch($this->makeCourse());
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/batches/'.$batch->getKey(), ['teacher_ids' => []])
            ->assertStatus(422);
    }
}
