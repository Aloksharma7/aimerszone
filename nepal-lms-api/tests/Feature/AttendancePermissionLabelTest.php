<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\ClassSession;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: classes/{sessionId}/attendance (save) and .../import were
 * route-gated on permission:attendance.view ("View attendance"), while the
 * authorization that actually runs in the controller — ClassSessionPolicy::
 * manage() — checks sessions.manage. Every built-in role that has one holds
 * the other, so nothing was ever exploitable; but a future custom role built
 * around the label ("give this account attendance.view so it can view and
 * take attendance") would find the real gate silently required a different
 * permission, and a role granted sessions.manage without attendance.view
 * would be wrongly turned away at the route before the correctly-written
 * policy ever ran. The route middleware now names the permission the policy
 * actually checks.
 */
class AttendancePermissionLabelTest extends TestCase
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

    public function test_a_teacher_with_sessions_manage_but_not_attendance_view_can_still_save_the_register(): void
    {
        [$session, $teacher, $student] = $this->makeLiveSession();

        Role::where('key', 'teacher')->firstOrFail()
            ->permissions()->detach(Permission::where('key', 'attendance.view')->firstOrFail());

        $this->actingAs($teacher)
            ->putJson('/api/v1/teacher/classes/'.$session->getKey().'/attendance', [
                'participants' => [
                    ['student_id' => $student->getKey(), 'attendance_status' => 'present'],
                ],
            ])
            ->assertOk();
    }

    public function test_a_teacher_with_attendance_view_but_not_sessions_manage_cannot_save_the_register(): void
    {
        [$session, $teacher, $student] = $this->makeLiveSession();

        Role::where('key', 'teacher')->firstOrFail()
            ->permissions()->detach(Permission::where('key', 'sessions.manage')->firstOrFail());

        $this->actingAs($teacher)
            ->putJson('/api/v1/teacher/classes/'.$session->getKey().'/attendance', [
                'participants' => [
                    ['student_id' => $student->getKey(), 'attendance_status' => 'present'],
                ],
            ])
            ->assertForbidden();
    }

    public function test_a_normal_teacher_can_still_save_and_import(): void
    {
        [$session, $teacher, $student] = $this->makeLiveSession();

        $this->actingAs($teacher)
            ->putJson('/api/v1/teacher/classes/'.$session->getKey().'/attendance', [
                'participants' => [
                    ['student_id' => $student->getKey(), 'attendance_status' => 'present'],
                ],
            ])
            ->assertOk();

        // No Zoom meeting is configured on this session, so import() reaches
        // its own domain error rather than authorization — proof the
        // permission gate itself let the request through.
        $this->actingAs($teacher)
            ->postJson('/api/v1/teacher/classes/'.$session->getKey().'/attendance/import')
            ->assertStatus(409)
            ->assertJsonPath('code', 'no_meeting_to_import');
    }
}
