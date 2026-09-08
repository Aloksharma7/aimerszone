<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Enums\RoleKey;
use App\Models\Payment;
use App\Services\SettingsRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: eSewa checkout only ever checked "batch closed" and "already
 * enrolled" — never "a manual payment for this batch is already under
 * review" or "the batch has since filled up". A student could keep both an
 * accountant-reviewed screenshot payment and a self-verifying eSewa payment
 * open for the same seat at once, and if both were independently approved
 * the institution booked revenue twice for one seat (Enrollment's own
 * unique constraint only stops the seat itself from being duplicated, not
 * the double Payment/Receipt). checkout() now shares the exact same
 * assertEnrollable() rules PaymentSubmissionService uses for the manual
 * flow, under the same locked-batch transaction.
 */
class PaymentDuplicationRaceTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();

        $settings = app(SettingsRepository::class);
        $settings->set('features', 'esewa_checkout', true);
        $settings->set('esewa', 'merchant_code', 'EPAYTEST');
        $settings->set('esewa', 'secret_key', 'test-secret', encrypt: true);
        $settings->flush();
    }

    public function test_esewa_checkout_is_blocked_while_a_manual_payment_is_already_under_review(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);

        // Already submitted a screenshot for the same batch; PaymentStatus
        // default from the fixture is Submitted, which pendingReview() matches.
        $this->makePayment($student, $batch);

        $this->actingAs($student)
            ->postJson('/api/v1/student/payments/esewa/checkout', ['batch_id' => $batch->getKey()])
            ->assertStatus(409)
            ->assertJsonPath('code', 'payment_already_pending');

        // No second (Draft, gateway) row was created behind the rejected request.
        $this->assertSame(1, Payment::where('user_id', $student->getKey())->where('batch_id', $batch->getKey())->count());
    }

    public function test_esewa_checkout_is_blocked_once_the_batch_is_full(): void
    {
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course, ['capacity' => 1]);

        $existing = $this->makeUser(RoleKey::Student);
        $this->enroll($existing, $batch);

        $latecomer = $this->makeUser(RoleKey::Student);

        $this->actingAs($latecomer)
            ->postJson('/api/v1/student/payments/esewa/checkout', ['batch_id' => $batch->getKey()])
            ->assertStatus(409)
            ->assertJsonPath('code', 'batch_full');

        $this->assertSame(0, Payment::where('user_id', $latecomer->getKey())->count());
    }

    public function test_esewa_checkout_still_succeeds_for_a_genuinely_open_seat(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);

        $response = $this->actingAs($student)
            ->postJson('/api/v1/student/payments/esewa/checkout', ['batch_id' => $batch->getKey()])
            ->assertOk();

        $this->assertIsString($response->json('data.transaction_uuid'));
        $this->assertNotSame('', $response->json('data.transaction_uuid'));

        $payment = Payment::where('user_id', $student->getKey())->where('batch_id', $batch->getKey())->sole();
        $this->assertSame(PaymentStatus::Draft, $payment->status);
    }

    public function test_reopening_checkout_reuses_the_same_draft_payment_instead_of_stacking_rows(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);

        $this->actingAs($student)
            ->postJson('/api/v1/student/payments/esewa/checkout', ['batch_id' => $batch->getKey()])
            ->assertOk();

        $this->actingAs($student)
            ->postJson('/api/v1/student/payments/esewa/checkout', ['batch_id' => $batch->getKey()])
            ->assertOk();

        $this->assertSame(1, Payment::where('user_id', $student->getKey())->where('batch_id', $batch->getKey())->count());
    }
}
