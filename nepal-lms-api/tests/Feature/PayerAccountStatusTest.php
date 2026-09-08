<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\Enrollment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: approving a payment never checked the payer's own account
 * status. A student could be archived or suspended while their payment
 * still sat in the review queue, and approving it later created a real,
 * capacity-consuming Enrollment for an account EnsureAccountIsUsable
 * blocks at every request, permanently — a phantom seat that made a
 * capacity-limited batch read as full to a genuine paying student.
 */
class PayerAccountStatusTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_payment_cannot_be_approved_for_a_suspended_account(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student, ['status' => 'suspended']);
        $accountant = $this->makeUser(RoleKey::Staff);
        $payment = $this->makePayment($student, $batch);

        $this->actingAs($accountant)
            ->postJson('/api/v1/accounting/payments/'.$payment->getKey().'/decision', ['decision' => 'approve'])
            ->assertStatus(409)
            ->assertJsonPath('code', 'payer_account_unusable');

        $this->assertSame(0, Enrollment::where('user_id', $student->getKey())->count());
    }

    public function test_a_payment_cannot_be_approved_for_an_archived_account(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);
        $payment = $this->makePayment($student, $batch);

        $student->delete();

        $this->actingAs($accountant)
            ->postJson('/api/v1/accounting/payments/'.$payment->getKey().'/decision', ['decision' => 'approve'])
            ->assertStatus(409)
            ->assertJsonPath('code', 'payer_account_unusable');
    }

    public function test_a_payment_for_an_active_account_still_approves_normally(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);
        $payment = $this->makePayment($student, $batch);

        $this->actingAs($accountant)
            ->postJson('/api/v1/accounting/payments/'.$payment->getKey().'/decision', ['decision' => 'approve'])
            ->assertOk();

        $this->assertSame(1, Enrollment::where('user_id', $student->getKey())->count());
    }

    public function test_an_archived_payers_pending_payment_shows_a_fallback_name_in_the_queue(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);
        $this->makePayment($student, $batch);

        $student->delete();

        $response = $this->actingAs($accountant)->getJson('/api/v1/accounting/payments')->assertOk();

        $this->assertTrue(collect($response->json('data'))->contains('student_name', 'Removed account'));
    }
}
