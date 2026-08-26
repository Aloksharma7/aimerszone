<?php

namespace Tests\Feature;

use App\Enums\EnrollmentStatus;
use App\Enums\RoleKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
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

    /**
     * Regression: show() (the single-recording fetch, used when opening a
     * recording directly rather than from a list) never included
     * enrollment_id in its response, unlike index(). The frontend uses this
     * field both to redirect to the course-scoped viewer and to confirm the
     * viewer belongs to the right course — with it missing, the redirect
     * silently never fired and the match guard failed open instead of
     * closed. Reported by the user as "clicking play redirects to the
     * course page instead of playing."
     */
    public function test_opening_a_recording_directly_includes_its_enrollment_id(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $enrollment = $this->enroll($student, $batch);
        $recording = $this->makeRecording($batch);

        $this->actingAs($student)
            ->getJson('/api/v1/student/recordings/'.$recording->getKey())
            ->assertOk()
            ->assertJsonPath('data.enrollment_id', $enrollment->getKey());
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

    /**
     * Regression: PaymentPolicy::viewProof() already allowed a student to
     * view their own evidence (payment.user_id === user.id), but no route
     * ever existed to reach it — only the accounting side had one. A student
     * could never see what they themselves had uploaded.
     */
    public function test_a_student_can_view_their_own_payment_proof(): void
    {
        Storage::fake('local');

        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $payment = $this->makePayment($student, $batch, [
            'proof_path' => UploadedFile::fake()->image('proof.jpg')->store('payment-proof/test', 'local'),
            'proof_disk' => 'local',
            'proof_mime' => 'image/jpeg',
        ]);

        $this->actingAs($student)
            ->postJson('/api/v1/student/payments/'.$payment->getKey().'/proof')
            ->assertOk()
            ->assertJsonStructure(['data' => ['url', 'expires_at']]);
    }

    public function test_a_student_cannot_view_another_students_payment_proof(): void
    {
        Storage::fake('local');

        $batch = $this->makeBatch($this->makeCourse());
        $owner = $this->makeUser(RoleKey::Student);
        $intruder = $this->makeUser(RoleKey::Student);
        $payment = $this->makePayment($owner, $batch, [
            'proof_path' => UploadedFile::fake()->image('proof.jpg')->store('payment-proof/test', 'local'),
            'proof_disk' => 'local',
            'proof_mime' => 'image/jpeg',
        ]);

        $this->actingAs($intruder)
            ->postJson('/api/v1/student/payments/'.$payment->getKey().'/proof')
            ->assertForbidden();
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
