<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: Accounting\PaymentController::proof() and Student\PaymentController::
 * proof() both audit-log 'payment.proof_viewed'; Staff\PaymentSubmissionController::
 * proof() — the identical action reached from the staff payment-capture queue
 * — silently did not. Same evidence, same sensitivity (PaymentPolicy::viewProof()
 * gates all three alike), one of the three paths simply never left a trail of
 * who opened a student's payment screenshot and when.
 */
class StaffProofViewAuditTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_staff_viewing_a_captured_payments_proof_is_audit_logged(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $staff = $this->makeUser(RoleKey::Staff);
        $payment = $this->makePayment($student, $batch, ['proof_path' => 'payment-proof/fake.jpg']);

        $this->actingAs($staff)
            ->postJson('/api/v1/staff/payment-submissions/'.$payment->getKey().'/proof')
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'payment.proof_viewed',
            'target_id' => $payment->getKey(),
            'actor_id' => $staff->getKey(),
        ]);
    }
}
