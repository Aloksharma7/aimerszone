<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: enrollments had a roster list and an export, and nothing
 * else — no way to open a single seat, cancel it, or remove one created by
 * mistake. This adds all three, mirroring the archive/delete pattern
 * already used for courses and batches: cancel is the everyday action
 * (revokes access, keeps the row for payment/attendance history), and a
 * true permanent delete is refused the moment a real payment is behind it.
 */
class StaffEnrollmentManagementTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_staff_member_can_view_a_single_enrollment(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $student = $this->makeUser(RoleKey::Student);
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $enrollment = $this->enroll($student, $batch);

        $this->actingAs($staff)
            ->getJson("/api/v1/staff/enrollments/{$enrollment->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $enrollment->id)
            ->assertJsonPath('data.student_name', $student->name)
            ->assertJsonPath('data.status', 'active');
    }

    public function test_a_staff_member_can_cancel_an_enrollment(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $student = $this->makeUser(RoleKey::Student);
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $enrollment = $this->enroll($student, $batch);

        $this->actingAs($staff)
            ->postJson("/api/v1/staff/enrollments/{$enrollment->id}/cancel", ['reason' => 'Student requested a refund and withdrawal.'])
            ->assertOk();

        $this->assertDatabaseHas('enrollments', ['id' => $enrollment->id, 'status' => 'cancelled']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'enrollment.cancelled', 'target_id' => $enrollment->id]);
        $this->assertTrue($enrollment->fresh()->access_end_at->isPast());
    }

    public function test_cancelling_an_already_cancelled_enrollment_is_refused(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $student = $this->makeUser(RoleKey::Student);
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $enrollment = $this->enroll($student, $batch, ['status' => 'cancelled', 'cancelled_at' => now()]);

        $this->actingAs($staff)
            ->postJson("/api/v1/staff/enrollments/{$enrollment->id}/cancel", ['reason' => 'Duplicate cancellation attempt.'])
            ->assertStatus(409)
            ->assertJsonPath('code', 'already_cancelled');
    }

    public function test_an_enrollment_with_no_payment_can_be_permanently_deleted(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $student = $this->makeUser(RoleKey::Student);
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $enrollment = $this->enroll($student, $batch, ['source' => 'staff', 'approved_payment_id' => null]);

        $this->actingAs($staff)
            ->deleteJson("/api/v1/staff/enrollments/{$enrollment->id}")
            ->assertOk();

        $this->assertDatabaseMissing('enrollments', ['id' => $enrollment->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'enrollment.deleted', 'target_id' => $enrollment->id]);
    }

    public function test_an_enrollment_with_a_payment_cannot_be_permanently_deleted(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $student = $this->makeUser(RoleKey::Student);
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $enrollment = $this->enroll($student, $batch);
        $this->makePayment($student, $batch, ['enrollment_id' => $enrollment->id, 'status' => 'approved']);

        $response = $this->actingAs($staff)->deleteJson("/api/v1/staff/enrollments/{$enrollment->id}");

        $response->assertStatus(409)->assertJsonPath('code', 'enrollment_has_payment');
        $this->assertDatabaseHas('enrollments', ['id' => $enrollment->id]);
    }

    public function test_a_teacher_cannot_cancel_or_delete_an_enrollment(): void
    {
        $teacher = $this->makeUser(RoleKey::Teacher);
        $student = $this->makeUser(RoleKey::Student);
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $enrollment = $this->enroll($student, $batch);

        $this->actingAs($teacher)
            ->postJson("/api/v1/staff/enrollments/{$enrollment->id}/cancel", ['reason' => 'Not authorized.'])
            ->assertForbidden();

        $this->actingAs($teacher)
            ->deleteJson("/api/v1/staff/enrollments/{$enrollment->id}")
            ->assertForbidden();
    }
}
