<?php

namespace Tests\Feature;

use App\Enums\EnrollmentStatus;
use App\Enums\RoleKey;
use App\Models\Enrollment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: WarnExpiringEnrollments sends its warning exactly once per
 * enrolment, tracked by `expiry_warned_at`, and nothing ever reset that
 * column back to null. A student who let access lapse once, got warned, and
 * later renewed (a completely normal "new term" flow) kept the old
 * `expiry_warned_at` forever — so their second access period could expire
 * with zero warning, exactly the silent-cutoff failure the warning feature
 * exists to prevent, but now only for repeat/renewing students.
 */
class EnrollmentRenewalTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_paid_renewal_resets_the_expiry_warning(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);

        $lapsed = $this->enroll($student, $batch, [
            'status' => EnrollmentStatus::Expired->value,
            'access_start_at' => now()->subDays(200),
            'access_end_at' => now()->subDays(20),
            'expiry_warned_at' => now()->subDays(27),
        ]);

        $payment = $this->makePayment($student, $batch);

        $this->actingAs($accountant)
            ->postJson('/api/v1/accounting/payments/'.$payment->getKey().'/decision', ['decision' => 'approve'])
            ->assertOk();

        $fresh = $lapsed->fresh();
        $this->assertSame('active', $fresh->status->value);
        $this->assertNull($fresh->expiry_warned_at);
        $this->assertTrue($fresh->access_end_at->isFuture());
    }

    public function test_a_free_renewal_resets_the_expiry_warning_and_never_shortens_access(): void
    {
        $batch = $this->makeBatch($this->makeCourse(['access_type' => \App\Enums\AccessType::Free->value]), [
            'price_npr' => 0,
        ]);
        $student = $this->makeUser(RoleKey::Student);

        $farFutureEnd = now()->addDays(300);
        $lapsed = $this->enroll($student, $batch, [
            'status' => EnrollmentStatus::Expired->value,
            'access_start_at' => now()->subDays(400),

            // Deliberately later than what a fresh 180-day re-enroll would
            // compute, so a naive overwrite would visibly shorten access.
            'access_end_at' => $farFutureEnd,
            'expiry_warned_at' => now()->subDays(10),
        ]);

        $this->actingAs($student)
            ->postJson('/api/v1/student/enroll-free', ['batch_id' => $batch->getKey()])
            ->assertCreated();

        $fresh = Enrollment::whereKey($lapsed->getKey())->first();
        $this->assertSame('active', $fresh->status->value);
        $this->assertNull($fresh->expiry_warned_at);
        $this->assertLessThan(2, $fresh->access_end_at->diffInSeconds($farFutureEnd), 'A renewal must never shorten access the student already holds.');
    }
}
