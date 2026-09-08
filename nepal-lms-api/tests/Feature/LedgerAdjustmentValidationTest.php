<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Enums\RoleKey;
use App\Models\LedgerAdjustment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: storeAdjustment() had none of the guardrails its sibling
 * storeRefund() has in the same file — no transaction/lock, no check that
 * the payment was actually approved, and no cap relating a discount/waiver
 * to what was actually paid. A waiver larger than the payment itself, or
 * repeated indefinitely against the same payment, went through with nothing
 * but a flat per-request ceiling to stop it.
 */
class LedgerAdjustmentValidationTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_waiver_cannot_exceed_the_amount_actually_paid(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);

        $payment = $this->makePayment($student, $batch, [
            'status' => PaymentStatus::Approved->value,
            'reviewed_at' => now(),
        ]);

        $this->actingAs($accountant)
            ->postJson('/api/v1/accounting/adjustments', [
                'payment_id' => $payment->getKey(),
                'type' => 'waiver',
                'amount_npr' => 9000,
                'reason' => 'Attempting to waive more than was ever paid.',
                'authorization_reference' => 'MEMO-001',
            ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'adjustment_exceeds_payment');
    }

    public function test_cumulative_waivers_cannot_exceed_the_amount_actually_paid(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);

        $payment = $this->makePayment($student, $batch, [
            'status' => PaymentStatus::Approved->value,
            'reviewed_at' => now(),
        ]);

        $this->actingAs($accountant)
            ->postJson('/api/v1/accounting/adjustments', [
                'payment_id' => $payment->getKey(),
                'type' => 'waiver',
                'amount_npr' => 3000,
                'reason' => 'First partial waiver, well within the payment.',
                'authorization_reference' => 'MEMO-002',
            ])
            ->assertCreated();

        $this->actingAs($accountant)
            ->postJson('/api/v1/accounting/adjustments', [
                'payment_id' => $payment->getKey(),
                'type' => 'waiver',
                'amount_npr' => 3000,
                'reason' => 'Second waiver that pushes the total past the payment.',
                'authorization_reference' => 'MEMO-003',
            ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'adjustment_exceeds_payment');
    }

    public function test_an_adjustment_cannot_be_posted_against_an_unapproved_payment(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);

        $payment = $this->makePayment($student, $batch);

        $this->actingAs($accountant)
            ->postJson('/api/v1/accounting/adjustments', [
                'payment_id' => $payment->getKey(),
                'type' => 'discount',
                'amount_npr' => 500,
                'reason' => 'This payment was never approved.',
                'authorization_reference' => 'MEMO-004',
            ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'payment_not_approved');
    }

    public function test_a_valid_penalty_still_goes_through_and_is_audited(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);

        $payment = $this->makePayment($student, $batch, [
            'status' => PaymentStatus::Approved->value,
            'reviewed_at' => now(),
        ]);

        $response = $this->actingAs($accountant)
            ->postJson('/api/v1/accounting/adjustments', [
                'payment_id' => $payment->getKey(),
                'type' => 'penalty',
                'amount_npr' => 200,
                'reason' => 'Late payment penalty as agreed with the student.',
                'authorization_reference' => 'MEMO-005',
            ])
            ->assertCreated();

        $adjustment = LedgerAdjustment::findOrFail($response->json('data.id'));
        $this->assertSame(200, $adjustment->amount_npr);
        $this->assertDatabaseHas('audit_logs', ['action' => 'adjustment.created', 'target_id' => $adjustment->getKey()]);
    }
}
