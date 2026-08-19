<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Enums\RoleKey;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\Receipt;
use App\Services\PaymentDecisionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * The approval transaction is the only path by which money becomes access,
 * so it gets the most scrutiny.
 */
class PaymentApprovalTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_approval_activates_enrollment_and_issues_a_receipt(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);
        $payment = $this->makePayment($student, $batch);

        $this->actingAs($accountant)
            ->postJson('/api/v1/accounting/payments/'.$payment->getKey().'/decision', [
                'decision' => 'approve',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $enrollment = Enrollment::where('user_id', $student->getKey())->where('batch_id', $batch->getKey())->first();

        $this->assertNotNull($enrollment, 'Approval must create the enrollment.');
        $this->assertTrue($enrollment->grantsAccess());
        $this->assertDatabaseHas('receipts', ['payment_id' => $payment->getKey()]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'payment.approved', 'target_id' => $payment->getKey()]);

        $receipt = \App\Models\Receipt::where('payment_id', $payment->getKey())->firstOrFail();
        $this->assertNotNull($receipt->pdf_path, 'Approval must render and store the receipt PDF.');
        $this->assertTrue(\Illuminate\Support\Facades\Storage::disk('local')->exists($receipt->pdf_path));
    }

    /**
     * Regression: pdf_path was a column nobody ever wrote to, so every
     * "Download receipt" click in the student portal returned 404.
     */
    public function test_a_student_can_download_the_actual_receipt_pdf(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);
        $payment = $this->makePayment($student, $batch);

        $this->actingAs($accountant)
            ->postJson('/api/v1/accounting/payments/'.$payment->getKey().'/decision', ['decision' => 'approve'])
            ->assertOk();

        $receipt = \App\Models\Receipt::where('payment_id', $payment->getKey())->firstOrFail();

        $destination = $this->actingAs($student)
            ->postJson('/api/v1/student/receipts/'.$receipt->getKey().'/download')
            ->assertOk()
            ->json('data');

        $path = parse_url($destination['url'], PHP_URL_PATH).'?'.parse_url($destination['url'], PHP_URL_QUERY);

        $this->actingAs($student)
            ->get($path)
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_the_officer_who_submitted_a_payment_cannot_approve_it(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);

        // Staff holds both enrollment and payment-review capability, but the
        // person who submitted a payment still must not self-approve it.
        $officer = $this->makeUser(RoleKey::Staff);

        $payment = $this->makePayment($student, $batch, ['submitted_by' => $officer->getKey()]);

        $this->actingAs($officer)
            ->postJson('/api/v1/accounting/payments/'.$payment->getKey().'/decision', ['decision' => 'approve'])
            ->assertForbidden();

        $this->assertSame(PaymentStatus::Submitted, $payment->fresh()->status);
        $this->assertDatabaseCount('receipts', 0);
    }

    public function test_approving_twice_does_not_create_a_second_seat_or_receipt(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);
        $payment = $this->makePayment($student, $batch);

        $decisions = app(PaymentDecisionService::class);
        $decisions->approve($payment->fresh(), $accountant);

        // The second decision must be refused, not silently repeated.
        $this->expectException(\App\Exceptions\DomainException::class);

        try {
            $decisions->approve($payment->fresh(), $accountant);
        } finally {
            $this->assertSame(1, Enrollment::where('batch_id', $batch->getKey())->count());
            $this->assertSame(1, Receipt::count());
        }
    }

    public function test_rejection_records_the_reason_and_grants_no_access(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);
        $payment = $this->makePayment($student, $batch);

        $this->actingAs($accountant)
            ->postJson('/api/v1/accounting/payments/'.$payment->getKey().'/decision', [
                'decision' => 'reject',
                'reason' => 'The screenshot does not show a completed transfer.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');

        $this->assertSame(0, Enrollment::where('batch_id', $batch->getKey())->count());
        $this->assertNotNull($payment->fresh()->rejection_reason);
    }

    public function test_rejecting_without_a_reason_is_refused(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);
        $payment = $this->makePayment($student, $batch);

        $this->actingAs($accountant)
            ->postJson('/api/v1/accounting/payments/'.$payment->getKey().'/decision', ['decision' => 'reject'])
            ->assertStatus(422);
    }

    public function test_a_student_cannot_reach_the_accounting_decision_endpoint(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $payment = $this->makePayment($student, $batch);

        $this->actingAs($student)
            ->postJson('/api/v1/accounting/payments/'.$payment->getKey().'/decision', ['decision' => 'approve'])
            ->assertForbidden();
    }

    /**
     * Regression: a refund could be requested but never completed, so recorded
     * refunds never reached the collections report.
     */
    public function test_a_requested_refund_can_be_completed(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $requester = $this->makeUser(RoleKey::Staff);
        $completer = $this->makeUser(RoleKey::Staff);

        $payment = $this->makePayment($student, $batch, [
            'status' => PaymentStatus::Approved->value,
            'reviewed_at' => now(),
        ]);

        $refundId = $this->actingAs($requester)
            ->postJson('/api/v1/accounting/refunds', [
                'payment_id' => $payment->getKey(),
                'amount_npr' => 2000,
                'reason' => 'Partial refund agreed with the student.',
            ])
            ->assertCreated()
            ->json('data.id');

        // The requester must not also record the payout.
        $this->actingAs($requester)
            ->postJson('/api/v1/accounting/refunds/'.$refundId.'/complete')
            ->assertForbidden();

        $this->actingAs($completer)
            ->postJson('/api/v1/accounting/refunds/'.$refundId.'/complete', ['reference' => 'BANK-991'])
            ->assertOk()
            ->assertJsonPath('data.status', 'processed');

        $this->assertNotNull(\App\Models\Refund::find($refundId)->processed_at);
    }

    public function test_a_refund_cannot_exceed_the_amount_actually_paid(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);

        $payment = $this->makePayment($student, $batch, [
            'status' => PaymentStatus::Approved->value,
            'reviewed_at' => now(),
            'reviewed_by' => $accountant->getKey(),
        ]);

        $this->actingAs($accountant)
            ->postJson('/api/v1/accounting/refunds', [
                'payment_id' => $payment->getKey(),
                'amount_npr' => 9000,
                'reason' => 'Student withdrew from the course entirely.',
            ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'refund_exceeds_payment');
    }
}
