<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\Attendance;
use App\Models\ClassSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: a student opening the join link is the weakest of three
 * attendance sources (join_link < zoom_import < manual) but had no guard
 * against overwriting the stronger two — so a teacher marking a student
 * Absent with a reason, followed by that student opening the join link
 * (still inside the join window, or during the live class itself), silently
 * flipped the row back to Present with no signal anything had changed
 * underneath the teacher's saved decision.
 *
 * Also covers the previously-missing "reopen a finalized register" action:
 * before this, a finalized register was locked forever with no correction
 * path anywhere in the app, despite the UI's own error text promising an
 * administrator could reopen it.
 */
class AttendanceOverridesTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    private function makeLiveSession(): array
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);
        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);

        $session = ClassSession::create([
            'batch_id' => $batch->getKey(),
            'teacher_id' => $teacher->getKey(),
            'topic' => 'Live class',
            'status' => 'live',
            'starts_at' => now()->subMinutes(10),
            'ends_at' => now()->addMinutes(40),
            'zoom_join_url' => 'https://zoom.example.test/j/123',
        ]);

        return [$session, $teacher, $student, $batch];
    }

    public function test_joining_does_not_overwrite_a_manual_absent_mark(): void
    {
        [$session, , $student] = $this->makeLiveSession();

        Attendance::create([
            'class_session_id' => $session->getKey(),
            'user_id' => $student->getKey(),
            'status' => 'absent',
            'note' => 'Confirmed with the student they could not attend.',
            'source' => 'manual',
            'marked_at' => now(),
        ]);

        $this->actingAs($student)
            ->postJson('/api/v1/student/classes/'.$session->getKey().'/join')
            ->assertOk();

        $this->assertDatabaseHas('attendances', [
            'class_session_id' => $session->getKey(),
            'user_id' => $student->getKey(),
            'status' => 'absent',
            'source' => 'manual',
        ]);
    }

    public function test_joining_does_not_overwrite_a_zoom_imported_mark(): void
    {
        [$session, , $student] = $this->makeLiveSession();

        Attendance::create([
            'class_session_id' => $session->getKey(),
            'user_id' => $student->getKey(),
            'status' => 'late',
            'source' => 'zoom_import',
            'marked_at' => now(),
        ]);

        $this->actingAs($student)
            ->postJson('/api/v1/student/classes/'.$session->getKey().'/join')
            ->assertOk();

        $this->assertDatabaseHas('attendances', [
            'class_session_id' => $session->getKey(),
            'user_id' => $student->getKey(),
            'status' => 'late',
            'source' => 'zoom_import',
        ]);
    }

    public function test_joining_still_records_provisional_attendance_when_nothing_exists_yet(): void
    {
        [$session, , $student] = $this->makeLiveSession();

        $this->actingAs($student)
            ->postJson('/api/v1/student/classes/'.$session->getKey().'/join')
            ->assertOk();

        $this->assertDatabaseHas('attendances', [
            'class_session_id' => $session->getKey(),
            'user_id' => $student->getKey(),
            'source' => 'join_link',
        ]);
    }

    public function test_an_admin_can_reopen_a_finalized_register_but_a_teacher_cannot(): void
    {
        [$session, $teacher, $student] = $this->makeLiveSession();
        $admin = $this->makeUser(RoleKey::Admin);

        $session->forceFill([
            'attendance_finalized_at' => now(),
            'attendance_finalized_by' => $teacher->getKey(),
        ])->save();

        // The teacher who finalized it cannot undo their own decision.
        $this->actingAs($teacher)
            ->postJson('/api/v1/teacher/classes/'.$session->getKey().'/attendance/reopen', [
                'reason' => 'I finalized this by mistake before checking the roster.',
            ])
            ->assertForbidden();

        $this->actingAs($admin)
            ->postJson('/api/v1/teacher/classes/'.$session->getKey().'/attendance/reopen', [
                'reason' => 'Teacher finalized before the Zoom report was in; reopening to correct it.',
            ])
            ->assertOk()
            ->assertJsonPath('data.reopened', true);

        $fresh = $session->fresh();
        $this->assertNull($fresh->attendance_finalized_at);
        $this->assertNull($fresh->attendance_finalized_by);
        $this->assertDatabaseHas('audit_logs', ['action' => 'attendance.reopened']);

        // The register is genuinely usable again afterward.
        $this->actingAs($teacher)
            ->putJson('/api/v1/teacher/classes/'.$session->getKey().'/attendance', [
                'participants' => [
                    ['student_id' => $student->getKey(), 'attendance_status' => 'present'],
                ],
            ])
            ->assertOk();
    }

    public function test_reopen_requires_a_real_reason(): void
    {
        [$session, , ] = $this->makeLiveSession();
        $admin = $this->makeUser(RoleKey::Admin);

        $session->forceFill(['attendance_finalized_at' => now()])->save();

        $this->actingAs($admin)
            ->postJson('/api/v1/teacher/classes/'.$session->getKey().'/attendance/reopen', ['reason' => 'why'])
            ->assertStatus(422);
    }
}
