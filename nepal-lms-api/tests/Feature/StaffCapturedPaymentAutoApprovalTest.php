<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Enums\RoleKey;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\PaymentMethod;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * A staff member enrolling a student already looked at the payment evidence
 * (a WhatsApp screenshot, a counter payment) before capturing it here, so
 * unlike the accounting decision endpoint this does not wait on a second
 * reviewer — except when the submission itself is flagged.
 */
class StaffCapturedPaymentAutoApprovalTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
        Storage::fake('local');
    }

    public function test_a_clean_staff_submitted_payment_activates_the_seat_immediately(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $staff = $this->makeUser(RoleKey::Staff);

        $response = $this->actingAs($staff)
            ->postJson('/api/v1/staff/payment-submissions', [
                'student_id' => $student->getKey(),
                'course_id' => $batch->course_id,
                'batch_id' => $batch->getKey(),
                'payment_method' => PaymentMethod::first()->key,
                'amount_npr' => 5000,
                'payer_name' => $student->name,
                'payment_date' => now()->toDateString(),
                'status' => 'submitted',
                'proof' => UploadedFile::fake()->image('proof.jpg'),
            ])
            ->assertCreated();

        $response->assertJsonPath('data.status', 'approved');

        $payment = Payment::findOrFail($response->json('data.id'));
        $this->assertSame($staff->getKey(), $payment->submitted_by);
        $this->assertSame($staff->getKey(), $payment->reviewed_by);
        $this->assertDatabaseHas('audit_logs', ['action' => 'payment.approved_at_capture', 'target_id' => $payment->getKey()]);

        $enrollment = Enrollment::where('user_id', $student->getKey())->where('batch_id', $batch->getKey())->first();
        $this->assertNotNull($enrollment, 'The seat must activate on submission, not wait on a reviewer.');
        $this->assertTrue($enrollment->grantsAccess());
        $this->assertDatabaseHas('receipts', ['payment_id' => $payment->getKey()]);
    }

    /**
     * The same forgiving treatment must not extend to evidence the submission
     * itself already flagged as suspicious — a duplicate screenshot still
     * needs a second, different person to look at it.
     */
    public function test_a_flagged_submission_still_waits_on_a_different_reviewer(): void
    {
        $course = $this->makeCourse();
        $batchOne = $this->makeBatch($course);
        $batchTwo = $this->makeBatch($course);
        $firstStudent = $this->makeUser(RoleKey::Student);
        $secondStudent = $this->makeUser(RoleKey::Student);
        $staff = $this->makeUser(RoleKey::Staff);
        $anotherStaff = $this->makeUser(RoleKey::Staff);

        $proof = UploadedFile::fake()->image('reused-proof.jpg');

        // First submission consumes the evidence hash.
        $this->actingAs($staff)
            ->postJson('/api/v1/staff/payment-submissions', [
                'student_id' => $firstStudent->getKey(),
                'course_id' => $course->getKey(),
                'batch_id' => $batchOne->getKey(),
                'payment_method' => PaymentMethod::first()->key,
                'amount_npr' => 5000,
                'payer_name' => $firstStudent->name,
                'payment_date' => now()->toDateString(),
                'status' => 'submitted',
                'proof' => $proof,
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'approved');

        // Same file bytes reused for a second student: flagged as duplicate
        // evidence, so it must not auto-approve.
        $response = $this->actingAs($staff)
            ->postJson('/api/v1/staff/payment-submissions', [
                'student_id' => $secondStudent->getKey(),
                'course_id' => $course->getKey(),
                'batch_id' => $batchTwo->getKey(),
                'payment_method' => PaymentMethod::first()->key,
                'amount_npr' => 5000,
                'payer_name' => $secondStudent->name,
                'payment_date' => now()->toDateString(),
                'status' => 'submitted',
                'proof' => UploadedFile::fake()->image('reused-proof.jpg'),
            ])
            ->assertCreated();

        $response->assertJsonPath('data.status', 'submitted');

        $flaggedPayment = Payment::findOrFail($response->json('data.id'));
        $this->assertSame('duplicate_evidence', $flaggedPayment->risk_label);

        // The submitting officer still cannot approve their own flagged
        // submission — the ordinary separation-of-duties rule still applies.
        $this->actingAs($staff)
            ->postJson('/api/v1/accounting/payments/'.$flaggedPayment->getKey().'/decision', ['decision' => 'approve'])
            ->assertForbidden();

        $this->actingAs($anotherStaff)
            ->postJson('/api/v1/accounting/payments/'.$flaggedPayment->getKey().'/decision', ['decision' => 'approve'])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
    }
}
