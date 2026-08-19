<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\Enrollment;
use App\Models\EnrollmentRequest;
use App\Services\NotificationDispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: approving a scholarship/transfer request activated the
 * enrollment exactly like a free enrollment or a verified gateway payment
 * does, but — unlike those two — never told the student their seat was
 * live. They found out only by signing in and checking.
 */
class EnrollmentRequestTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_approving_an_enrollment_request_notifies_the_student(): void
    {
        // Scholarship on a paid course waives a real fee, so this now
        // requires Super Admin and a reason — see the waiver tests below.
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $student = $this->makeUser(RoleKey::Student);
        $officer = $this->makeUser(RoleKey::Staff);
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);

        $enrollmentRequest = EnrollmentRequest::create([
            'user_id' => $student->getKey(),
            'course_id' => $course->getKey(),
            'batch_id' => $batch->getKey(),
            'basis' => 'scholarship',
            'note' => 'Merit scholarship approved by the director.',
            'requested_by' => $officer->getKey(),
            'status' => 'pending',
        ]);

        $this->mock(NotificationDispatcher::class, function (MockInterface $mock) use ($student) {
            $mock->shouldReceive('enrollmentActivated')
                ->once()
                ->withArgs(fn (Enrollment $enrollment) => $enrollment->user_id === $student->getKey());
        });

        $this->actingAs($superAdmin)
            ->postJson('/api/v1/admin/enrollment-requests/'.$enrollmentRequest->getKey().'/decision', [
                'decision' => 'approve',
                'reason' => 'Merit scholarship confirmed with the finance office.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
    }

    /**
     * Regression: a scholarship or institutional-exception approval on a
     * normally-paid course granted a full seat with nothing but a typed
     * reason and no payment reference at all — indistinguishable from an
     * admin quietly waving through an unpaid (or informally, e.g.
     * WhatsApp-negotiated) enrollment. Now requires Super Admin and a reason.
     */
    public function test_a_plain_admin_cannot_waive_the_fee_on_a_paid_course(): void
    {
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $student = $this->makeUser(RoleKey::Student);
        $officer = $this->makeUser(RoleKey::Staff);
        $admin = $this->makeUser(RoleKey::Admin);

        $enrollmentRequest = EnrollmentRequest::create([
            'user_id' => $student->getKey(),
            'course_id' => $course->getKey(),
            'batch_id' => $batch->getKey(),
            'basis' => 'institutional_exception',
            'note' => 'Claims to have paid via WhatsApp.',
            'requested_by' => $officer->getKey(),
            'status' => 'pending',
        ]);

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/enrollment-requests/'.$enrollmentRequest->getKey().'/decision', [
                'decision' => 'approve',
                'reason' => 'Approving this now.',
            ])
            ->assertStatus(403)
            ->assertJsonPath('code', 'paid_waiver_requires_super_admin');

        $this->assertSame('pending', $enrollmentRequest->fresh()->status);
    }

    public function test_a_transfer_on_a_paid_course_does_not_require_super_admin(): void
    {
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $student = $this->makeUser(RoleKey::Student);
        $officer = $this->makeUser(RoleKey::Staff);
        $admin = $this->makeUser(RoleKey::Admin);

        $enrollmentRequest = EnrollmentRequest::create([
            'user_id' => $student->getKey(),
            'course_id' => $course->getKey(),
            'batch_id' => $batch->getKey(),
            'basis' => 'transfer',
            'note' => 'Moving from a cancelled batch where they already held a paid seat.',
            'requested_by' => $officer->getKey(),
            'status' => 'pending',
        ]);

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/enrollment-requests/'.$enrollmentRequest->getKey().'/decision', ['decision' => 'approve'])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
    }

    public function test_rejecting_an_enrollment_request_does_not_notify_anyone(): void
    {
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $student = $this->makeUser(RoleKey::Student);
        $officer = $this->makeUser(RoleKey::Staff);
        $admin = $this->makeUser(RoleKey::Admin);

        $enrollmentRequest = EnrollmentRequest::create([
            'user_id' => $student->getKey(),
            'course_id' => $course->getKey(),
            'batch_id' => $batch->getKey(),
            'basis' => 'transfer',
            'note' => 'Requested transfer from a cancelled batch.',
            'requested_by' => $officer->getKey(),
            'status' => 'pending',
        ]);

        $this->mock(NotificationDispatcher::class, function (MockInterface $mock) {
            $mock->shouldNotReceive('enrollmentActivated');
        });

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/enrollment-requests/'.$enrollmentRequest->getKey().'/decision', [
                'decision' => 'reject',
                'reason' => 'Batch is not accepting transfers this term.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');
    }
}
