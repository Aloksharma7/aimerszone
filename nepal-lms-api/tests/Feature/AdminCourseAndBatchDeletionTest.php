<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\Batch;
use App\Models\Course;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: the only "delete" a course or batch ever had was a soft
 * delete labelled "archive" everywhere (audit action, response message).
 * Worse, an archived record then vanished from index/show entirely with no
 * way to see it, restore it, or get rid of it for good — an admin who
 * archived a mistake by accident had no way back and no way to actually
 * remove it. This adds a real restore + a genuine permanent delete, gated
 * on the record never having had any enrolment/payment history.
 */
class AdminCourseAndBatchDeletionTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_an_unused_course_can_be_permanently_deleted(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $course = $this->makeCourse();

        $this->actingAs($admin)->deleteJson("/api/v1/admin/courses/{$course->id}")->assertOk();
        $this->assertSoftDeleted('courses', ['id' => $course->id]);

        $this->actingAs($admin)
            ->deleteJson("/api/v1/admin/courses/{$course->id}/permanent")
            ->assertOk();

        $this->assertDatabaseMissing('courses', ['id' => $course->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'course.deleted', 'target_id' => $course->id]);
    }

    public function test_a_course_with_enrolment_history_cannot_be_permanently_deleted(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $student = $this->makeUser(RoleKey::Student);
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course, ['status' => 'closed']);
        $this->enroll($student, $batch, ['status' => 'expired', 'access_end_at' => now()->subDay()]);

        $this->actingAs($admin)->deleteJson("/api/v1/admin/courses/{$course->id}")->assertOk();

        $response = $this->actingAs($admin)->deleteJson("/api/v1/admin/courses/{$course->id}/permanent");

        $response->assertStatus(409)->assertJsonPath('code', 'course_has_history');
        $this->assertSoftDeleted('courses', ['id' => $course->id]);
    }

    public function test_an_archived_course_can_be_restored(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $course = $this->makeCourse();

        $this->actingAs($admin)->deleteJson("/api/v1/admin/courses/{$course->id}")->assertOk();
        $this->actingAs($admin)->postJson("/api/v1/admin/courses/{$course->id}/restore")->assertOk();

        $this->assertDatabaseHas('courses', ['id' => $course->id, 'deleted_at' => null]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'course.restored', 'target_id' => $course->id]);
    }

    public function test_the_admin_course_listing_can_filter_to_archived_only(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $kept = $this->makeCourse();
        $archived = $this->makeCourse();
        $this->actingAs($admin)->deleteJson("/api/v1/admin/courses/{$archived->id}")->assertOk();

        $response = $this->actingAs($admin)->getJson('/api/v1/admin/courses?status=archived')->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertContains($archived->id, $ids);
        $this->assertNotContains($kept->id, $ids);
    }

    public function test_an_unused_batch_can_be_permanently_deleted(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);

        $this->actingAs($admin)->deleteJson("/api/v1/admin/batches/{$batch->id}")->assertOk();

        $this->actingAs($admin)
            ->deleteJson("/api/v1/admin/batches/{$batch->id}/permanent")
            ->assertOk();

        $this->assertDatabaseMissing('batches', ['id' => $batch->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'batch.deleted', 'target_id' => $batch->id]);
    }

    public function test_a_batch_with_payment_history_cannot_be_permanently_deleted(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $student = $this->makeUser(RoleKey::Student);
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course, ['status' => 'closed']);
        $this->makePayment($student, $batch, ['status' => 'approved']);

        $this->actingAs($admin)->deleteJson("/api/v1/admin/batches/{$batch->id}")->assertOk();

        $response = $this->actingAs($admin)->deleteJson("/api/v1/admin/batches/{$batch->id}/permanent");

        $response->assertStatus(409)->assertJsonPath('code', 'batch_has_payments');
        $this->assertSoftDeleted('batches', ['id' => $batch->id]);
    }

    public function test_an_archived_batch_can_be_restored(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);

        $this->actingAs($admin)->deleteJson("/api/v1/admin/batches/{$batch->id}")->assertOk();
        $this->actingAs($admin)->postJson("/api/v1/admin/batches/{$batch->id}/restore")->assertOk();

        $this->assertDatabaseHas('batches', ['id' => $batch->id, 'deleted_at' => null]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'batch.restored', 'target_id' => $batch->id]);
    }

    public function test_a_staff_member_cannot_permanently_delete_a_batch(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);

        $this->actingAs($staff)
            ->deleteJson("/api/v1/admin/batches/{$batch->id}/permanent")
            ->assertForbidden();
    }
}
