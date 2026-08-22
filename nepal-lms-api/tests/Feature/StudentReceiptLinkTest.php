<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Services\PaymentDecisionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: the student payment detail page built its "View receipt" link
 * by guessing REC-{payment_id} — a format that never matched a real
 * receipt, which has its own independent ULID and a separate human-readable
 * number. Approving a payment always 404'd the very link meant to show its
 * receipt. The payment resource now carries the receipt's real id so the
 * frontend never has to guess.
 */
class StudentReceiptLinkTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_an_approved_payments_receipt_id_is_the_receipts_real_id_not_a_guess(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);
        $payment = $this->makePayment($student, $batch);

        app(PaymentDecisionService::class)->approve($payment->fresh(), $accountant);

        $response = $this->actingAs($student)->getJson('/api/v1/student/payments')->assertOk();
        $receiptId = $response->json('data.0.receipt_id');

        $this->assertNotNull($receiptId);
        $this->assertNotSame('REC-'.$payment->getKey(), $receiptId, 'This is the guessed format the frontend used to construct — it must never match a real id.');
        $this->assertDatabaseHas('receipts', ['id' => $receiptId, 'payment_id' => $payment->getKey()]);

        // The link built from this id must actually resolve.
        $this->actingAs($student)
            ->getJson('/api/v1/student/receipts/'.$receiptId)
            ->assertOk();
    }

    public function test_a_payment_with_no_receipt_reports_a_null_receipt_id(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $payment = $this->makePayment($student, $batch);

        $response = $this->actingAs($student)->getJson('/api/v1/student/payments')->assertOk();

        $this->assertNull($response->json('data.0.receipt_id'));
    }
}
