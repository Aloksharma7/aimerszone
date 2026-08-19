<?php

namespace Tests\Feature;

use App\Enums\EnrollmentStatus;
use App\Enums\RoleKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * The boundaries that matter most for a paid platform: one student must never
 * reach another student's records, and access must actually stop when the
 * enrollment lapses.
 */
class StudentAccessBoundaryTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_student_cannot_open_another_students_course_workspace(): void
    {
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);

        $owner = $this->makeUser(RoleKey::Student);
        $intruder = $this->makeUser(RoleKey::Student);

        $enrollment = $this->enroll($owner, $batch);
        $this->enroll($intruder, $this->makeBatch($this->makeCourse()));

        // 404 rather than 403: the intruder should not learn the record exists.
        $this->actingAs($intruder)
            ->getJson('/api/v1/student/courses/'.$enrollment->getKey())
            ->assertNotFound();

        $this->actingAs($owner)
            ->getJson('/api/v1/student/courses/'.$enrollment->getKey())
            ->assertOk()
            ->assertJsonPath('data.id', $enrollment->getKey());
    }

    public function test_an_expired_enrollment_cannot_reach_a_released_recording(): void
    {
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $student = $this->makeUser(RoleKey::Student);
        $recording = $this->makeRecording($batch);

        $enrollment = $this->enroll($student, $batch);

        $this->actingAs($student)
            ->postJson('/api/v1/student/recordings/'.$recording->getKey().'/playback')
            ->assertOk();

        // The access window closes; nothing else about the account changes.
        $enrollment->forceFill([
            'access_end_at' => now()->subDay(),
            'status' => EnrollmentStatus::Expired->value,
        ])->save();

        $this->actingAs($student)
            ->postJson('/api/v1/student/recordings/'.$recording->getKey().'/playback')
            ->assertForbidden();
    }

    public function test_an_unreleased_recording_is_invisible_to_an_enrolled_student(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);

        $recording = $this->makeRecording($batch, ['released_at' => null]);

        $this->actingAs($student)
            ->postJson('/api/v1/student/recordings/'.$recording->getKey().'/playback')
            ->assertForbidden();
    }

    public function test_a_student_cannot_read_another_students_receipt(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $owner = $this->makeUser(RoleKey::Student);
        $intruder = $this->makeUser(RoleKey::Student);

        $payment = $this->makePayment($owner, $batch, ['status' => 'approved']);

        $receipt = \App\Models\Receipt::create([
            'payment_id' => $payment->getKey(),
            'number' => 'RCP-2026-00001',
            'issued_at' => now(),
            'amount_npr' => 5000,
            'snapshot' => ['student_name' => $owner->name],
        ]);

        $this->actingAs($intruder)
            ->getJson('/api/v1/student/receipts/'.$receipt->getKey())
            ->assertNotFound();
    }

    public function test_a_suspended_account_cannot_use_the_portal(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);

        $student->forceFill(['status' => 'suspended'])->save();

        $this->actingAs($student)
            ->getJson('/api/v1/student/dashboard')
            ->assertForbidden()
            ->assertJsonPath('code', 'account_suspended');
    }
}
