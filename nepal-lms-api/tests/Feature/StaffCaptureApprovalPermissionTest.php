<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Enums\RoleKey;
use App\Models\Enrollment;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: capturing a payment at the counter (Staff\PaymentSubmissionController::
 * store()) auto-approves it — granting real enrollment — whenever the evidence
 * comes back unflagged, gated only on payments.submit ("submit payment evidence
 * on behalf of a student"). It never checked payments.review ("approve or
 * reject payments"), the permission that is the actual gate on approval power
 * everywhere else in this module (PaymentPolicy::review(), viewProof()). An
 * admin who edits the staff role to drop payments.review — meaning "this
 * account can capture evidence but must not decide payments" — would have
 * that intent silently ignored for any capture that happened not to be
 * flagged. The auto-approve branch now also requires payments.review; without
 * it the capture is left Submitted for someone who holds that permission.
 */
class StaffCaptureApprovalPermissionTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    protected function payload(string $studentId, string $courseId): array
    {
        return [
            'student_id' => $studentId,
            'course_id' => $courseId,
            'payment_method' => 'esewa',
            'amount_npr' => 5000,
            'payer_name' => 'Counter Payer',
            'payment_date' => now()->toDateString(),
            'status' => 'submitted',
            'proof' => UploadedFile::fake()->image('proof.jpg'),
        ];
    }

    public function test_a_staff_member_with_both_permissions_still_gets_instant_approval(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $clerk = $this->makeUser(RoleKey::Staff);

        $response = $this->actingAs($clerk)
            ->postJson('/api/v1/staff/payment-submissions', $this->payload($student->getKey(), $batch->course_id))
            ->assertCreated();

        $this->assertSame('approved', $response->json('data.status'));
        $this->assertSame(1, Enrollment::where('user_id', $student->getKey())->count());
    }

    public function test_a_staff_role_without_payments_review_cannot_auto_approve_its_own_capture(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $clerk = $this->makeUser(RoleKey::Staff);

        // Simulate an admin customizing the staff role in Roles & Permissions
        // to remove approval power while leaving capture power in place.
        $staffRole = Role::where('key', 'staff')->firstOrFail();
        $staffRole->permissions()->detach(Permission::where('key', 'payments.review')->firstOrFail());

        $response = $this->actingAs($clerk)
            ->postJson('/api/v1/staff/payment-submissions', $this->payload($student->getKey(), $batch->course_id))
            ->assertCreated();

        $this->assertSame('submitted', $response->json('data.status'));
        $this->assertSame(0, Enrollment::where('user_id', $student->getKey())->count());

        $payment = \App\Models\Payment::findOrFail($response->json('data.id'));
        $this->assertSame(PaymentStatus::Submitted, $payment->status);
        $this->assertTrue($payment->isReviewable());
    }

    public function test_a_flagged_capture_still_queues_for_review_even_with_both_permissions(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $clerk = $this->makeUser(RoleKey::Staff);

        // Submitting less than the batch price flags the capture as a short
        // payment, which must fall through to the queue regardless of who
        // captured it or what permissions they hold.
        $data = $this->payload($student->getKey(), $batch->course_id);
        $data['amount_npr'] = 1000;

        $response = $this->actingAs($clerk)
            ->postJson('/api/v1/staff/payment-submissions', $data)
            ->assertCreated();

        $this->assertSame('submitted', $response->json('data.status'));
        $this->assertSame(0, Enrollment::where('user_id', $student->getKey())->count());
    }
}
