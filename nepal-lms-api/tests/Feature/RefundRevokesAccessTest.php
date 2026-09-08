<?php

namespace Tests\Feature;

use App\Enums\EnrollmentStatus;
use App\Enums\PaymentStatus;
use App\Enums\RoleKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: completing a refund only ever touched the Refund row — the
 * enrollment it paid for stayed Active with its original access_end_at
 * untouched, so a fully refunded student kept full access (live classes,
 * recordings, tests, resources) for the rest of the access window despite
 * the institution having given the money back.
 */
class RefundRevokesAccessTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_full_refund_revokes_the_enrollment_it_paid_for(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $requester = $this->makeUser(RoleKey::Staff);
        $completer = $this->makeUser(RoleKey::Staff);
        $enrollment = $this->enroll($student, $batch);

        $payment = $this->makePayment($student, $batch, [
            'status' => PaymentStatus::Approved->value,
            'reviewed_at' => now(),
            'enrollment_id' => $enrollment->getKey(),
        ]);

        $refundId = $this->actingAs($requester)
            ->postJson('/api/v1/accounting/refunds', [
                'payment_id' => $payment->getKey(),
                'amount_npr' => 5000,
                'reason' => 'Student withdrew from the course entirely.',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($completer)
            ->postJson('/api/v1/accounting/refunds/'.$refundId.'/complete')
            ->assertOk();

        $fresh = $enrollment->fresh();
        $this->assertSame('cancelled', $fresh->status->value);
        $this->assertTrue($fresh->access_end_at->isPast());
        $this->assertNotNull($fresh->cancelled_at);
        $this->assertFalse($fresh->grantsAccess());
    }

    public function test_a_partial_refund_does_not_revoke_access(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $requester = $this->makeUser(RoleKey::Staff);
        $completer = $this->makeUser(RoleKey::Staff);
        $enrollment = $this->enroll($student, $batch);

        $payment = $this->makePayment($student, $batch, [
            'status' => PaymentStatus::Approved->value,
            'reviewed_at' => now(),
            'enrollment_id' => $enrollment->getKey(),
        ]);

        $refundId = $this->actingAs($requester)
            ->postJson('/api/v1/accounting/refunds', [
                'payment_id' => $payment->getKey(),
                'amount_npr' => 1000,
                'reason' => 'Goodwill gesture for a missed class.',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($completer)
            ->postJson('/api/v1/accounting/refunds/'.$refundId.'/complete')
            ->assertOk();

        $fresh = $enrollment->fresh();
        $this->assertSame(EnrollmentStatus::Active, $fresh->status);
        $this->assertTrue($fresh->grantsAccess());
    }

    public function test_cumulative_partial_refunds_reaching_the_full_amount_revoke_access(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $requester = $this->makeUser(RoleKey::Staff);
        $completer = $this->makeUser(RoleKey::Staff);
        $enrollment = $this->enroll($student, $batch);

        $payment = $this->makePayment($student, $batch, [
            'status' => PaymentStatus::Approved->value,
            'reviewed_at' => now(),
            'enrollment_id' => $enrollment->getKey(),
        ]);

        foreach ([2000, 3000] as $amount) {
            $refundId = $this->actingAs($requester)
                ->postJson('/api/v1/accounting/refunds', [
                    'payment_id' => $payment->getKey(),
                    'amount_npr' => $amount,
                    'reason' => 'Staged refund agreed with the student.',
                ])
                ->assertCreated()
                ->json('data.id');

            $this->actingAs($completer)
                ->postJson('/api/v1/accounting/refunds/'.$refundId.'/complete')
                ->assertOk();
        }

        $this->assertSame('cancelled', $enrollment->fresh()->status->value);
    }
}
