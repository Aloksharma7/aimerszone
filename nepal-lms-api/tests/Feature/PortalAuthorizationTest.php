<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use PHPUnit\Framework\Attributes\DataProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Cross-portal checks: no role should be able to walk into another portal, and
 * a teacher should only reach the batches they actually teach.
 */
class PortalAuthorizationTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public static function portalMatrix(): array
    {
        return [
            'student cannot open teacher portal' => [RoleKey::Student, '/api/v1/teacher/dashboard'],
            'student cannot open staff portal' => [RoleKey::Student, '/api/v1/staff/students'],
            'student cannot open accounting portal' => [RoleKey::Student, '/api/v1/accounting/dashboard'],
            'student cannot open admin portal' => [RoleKey::Student, '/api/v1/admin/dashboard'],
            'teacher cannot open accounting portal' => [RoleKey::Teacher, '/api/v1/accounting/payments'],
            'teacher cannot open admin settings' => [RoleKey::Teacher, '/api/v1/admin/settings'],
            'staff cannot open teacher portal' => [RoleKey::Staff, '/api/v1/teacher/dashboard'],
            'staff cannot open admin portal' => [RoleKey::Staff, '/api/v1/admin/dashboard'],

            // Staff now covers both enrollment and payment review (merged
            // from the former enrollment_officer and accountant roles), so
            // it legitimately reaches both /staff and /accounting — the
            // boundary that matters is still "not another portal entirely."

            // Admin runs day-to-day operations but not settings, integrations
            // or role management — that stays exclusive to Super Admin.
            'admin cannot open settings' => [RoleKey::Admin, '/api/v1/admin/settings'],
            'admin cannot open roles management' => [RoleKey::Admin, '/api/v1/admin/roles'],
            'admin cannot open integrations' => [RoleKey::Admin, '/api/v1/admin/integrations/youtube/records'],
        ];
    }

    #[DataProvider('portalMatrix')]
    public function test_roles_cannot_cross_portal_boundaries(RoleKey $role, string $endpoint): void
    {
        $user = $this->makeUser($role);

        $this->actingAs($user)->getJson($endpoint)->assertForbidden();
    }

    public function test_an_unauthenticated_request_is_rejected_with_a_machine_code(): void
    {
        $this->getJson('/api/v1/student/dashboard')
            ->assertUnauthorized()
            ->assertJsonPath('code', 'unauthenticated');
    }

    public function test_a_teacher_cannot_read_a_batch_they_do_not_teach(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $assigned = $this->makeUser(RoleKey::Teacher);
        $other = $this->makeUser(RoleKey::Teacher);

        $batch->teachers()->attach($assigned->getKey(), ['is_lead' => true]);

        $this->actingAs($other)
            ->getJson('/api/v1/teacher/batches/'.$batch->getKey())
            ->assertNotFound();

        $this->actingAs($assigned)
            ->getJson('/api/v1/teacher/batches/'.$batch->getKey())
            ->assertOk();
    }

    public function test_an_administrator_cannot_remove_their_own_administrator_role(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/users/'.$admin->getKey(), ['primary_role' => 'student'])
            ->assertStatus(409)
            ->assertJsonPath('code', 'self_demotion_blocked');
    }

    /**
     * Admin's users.manage permission runs staff/teacher/student accounts,
     * not its own tier — only Super Admin may touch an Admin or Super Admin
     * account, or grant either role to someone else.
     */
    public function test_an_admin_cannot_manage_another_admin_account(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $otherAdmin = $this->makeUser(RoleKey::Admin);
        $staff = $this->makeUser(RoleKey::Staff);

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/users/'.$otherAdmin->getKey(), ['name' => 'Renamed'])
            ->assertForbidden();

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/users/'.$staff->getKey().'/actions/suspend', ['reason' => 'test'])
            ->assertOk();

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/users', [
                'name' => 'New Admin',
                'email' => 'new-admin-'.Str::lower(Str::random(6)).'@example.test',
                'primary_role' => 'admin',
                'password_setup_method' => 'link',
            ])
            ->assertStatus(403)
            ->assertJsonPath('code', 'admin_role_assignment_blocked');
    }

    /**
     * Regression: UserController::destroy never called authorize(), unlike
     * update()/administer() in the same file — an Admin could archive
     * another Admin or a Super Admin account through this one endpoint.
     */
    public function test_an_admin_cannot_archive_another_admin_account(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $otherAdmin = $this->makeUser(RoleKey::Admin);
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);
        $staff = $this->makeUser(RoleKey::Staff);

        $this->actingAs($admin)->deleteJson('/api/v1/admin/users/'.$otherAdmin->getKey())->assertForbidden();
        $this->actingAs($admin)->deleteJson('/api/v1/admin/users/'.$superAdmin->getKey())->assertForbidden();
        $this->assertDatabaseHas('users', ['id' => $otherAdmin->getKey(), 'deleted_at' => null]);

        // Admin can still archive the accounts it actually runs.
        $this->actingAs($admin)->deleteJson('/api/v1/admin/users/'.$staff->getKey())->assertOk();
    }

    /**
     * Regression: the "last administrator" lockout guard only counted the
     * literal 'admin' role, so the only Super Admin could be archived as
     * long as a plain Admin still existed — silently locking the platform
     * out of settings, integrations and role management forever.
     */
    public function test_the_only_super_admin_cannot_be_archived_even_if_a_plain_admin_remains(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);
        $this->makeUser(RoleKey::Admin);

        $this->actingAs($superAdmin)
            ->deleteJson('/api/v1/admin/users/'.$superAdmin->getKey())
            ->assertStatus(409)
            ->assertJsonPath('code', 'cannot_archive_self');

        // A second super admin makes the first one archivable.
        $secondSuperAdmin = $this->makeUser(RoleKey::SuperAdmin);
        $this->actingAs($secondSuperAdmin)
            ->deleteJson('/api/v1/admin/users/'.$superAdmin->getKey())
            ->assertOk();
    }

    public function test_a_super_admin_can_manage_an_admin_account(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);
        $admin = $this->makeUser(RoleKey::Admin);

        $this->actingAs($superAdmin)
            ->patchJson('/api/v1/admin/users/'.$admin->getKey(), ['name' => 'Renamed by super admin'])
            ->assertOk();
    }

    /**
     * Regression: the teacher's attendance screen offers a "Review" option that
     * the status enum rejected, so saving the whole register failed with a bare
     * validation error.
     */
    public function test_review_is_an_accepted_attendance_status_but_blocks_finalizing(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $student = $this->makeUser(RoleKey::Student);

        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);
        $this->enroll($student, $batch);

        $session = \App\Models\ClassSession::create([
            'batch_id' => $batch->getKey(),
            'teacher_id' => $teacher->getKey(),
            'topic' => 'Past class',
            'status' => 'completed',
            'starts_at' => now()->subHours(3),
            'ends_at' => now()->subHours(2),
        ]);

        $payload = ['participants' => [[
            'student_id' => $student->getKey(),
            'attendance_status' => 'review',
            'override_reason' => 'Connection dropped, checking the provider report.',
        ]]];

        // Saving a draft with an undecided row is fine.
        $this->actingAs($teacher)
            ->putJson('/api/v1/teacher/classes/'.$session->getKey().'/attendance', $payload)
            ->assertOk();

        // Finalizing with one still undecided is not.
        $this->actingAs($teacher)
            ->postJson('/api/v1/teacher/classes/'.$session->getKey().'/attendance/finalize', $payload)
            ->assertStatus(422)
            ->assertJsonPath('code', 'attendance_undecided');
    }

    /**
     * Regression: ClassSessionPolicy::start()/finalizeAttendance() and
     * TestPolicy::publish() used to fall back to `|| $user->isAdmin()`, so an
     * administrator could start a live class, attest attendance, or publish
     * a graded test for a batch it had no teaching relationship to. Those
     * are specifically the assigned teacher's own acts — admin can still
     * reschedule, view and manage the surrounding record, just not perform
     * these three. (Super Admin is unaffected: Gate::before bypasses every
     * policy regardless of this change.)
     */
    public function test_an_admin_cannot_start_a_class_they_do_not_teach(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $admin = $this->makeUser(RoleKey::Admin);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $session = \App\Models\ClassSession::create([
            'batch_id' => $batch->getKey(),
            'teacher_id' => $teacher->getKey(),
            'topic' => 'Upcoming class',
            'status' => 'scheduled',
            'starts_at' => now()->addMinutes(10),
            'ends_at' => now()->addHour(),
        ]);

        $this->actingAs($admin)
            ->postJson('/api/v1/teacher/classes/'.$session->getKey().'/start')
            ->assertForbidden();
    }

    public function test_an_admin_cannot_finalize_attendance_for_a_class_they_do_not_teach(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $admin = $this->makeUser(RoleKey::Admin);
        $student = $this->makeUser(RoleKey::Student);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);
        $this->enroll($student, $batch);

        $session = \App\Models\ClassSession::create([
            'batch_id' => $batch->getKey(),
            'teacher_id' => $teacher->getKey(),
            'topic' => 'Past class',
            'status' => 'completed',
            'starts_at' => now()->subHours(3),
            'ends_at' => now()->subHours(2),
        ]);

        $payload = ['participants' => [[
            'student_id' => $student->getKey(),
            'attendance_status' => 'present',
        ]]];

        $this->actingAs($admin)
            ->postJson('/api/v1/teacher/classes/'.$session->getKey().'/attendance/finalize', $payload)
            ->assertForbidden();
    }

    public function test_an_admin_cannot_publish_a_test_for_a_batch_they_do_not_teach(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $admin = $this->makeUser(RoleKey::Admin);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $test = $this->makeTest($batch);
        \App\Models\TestQuestion::create([
            'test_id' => $test->getKey(),
            'order' => 1,
            'type' => 'single',
            'prompt' => 'What is 1 + 1?',
            'marks' => 2,
        ]);

        $this->actingAs($admin)
            ->postJson('/api/v1/teacher/tests/'.$test->getKey().'/publish')
            ->assertForbidden();

        $this->actingAs($teacher)
            ->postJson('/api/v1/teacher/tests/'.$test->getKey().'/publish')
            ->assertOk();
    }

    public function test_the_public_catalogue_hides_unpublished_courses(): void
    {
        $published = $this->makeCourse(['title' => 'Visible Course']);
        $draft = $this->makeCourse(['published' => false, 'status' => 'draft', 'title' => 'Hidden Course']);

        $response = $this->getJson('/api/v1/public/courses')->assertOk();

        $titles = collect($response->json('data'))->pluck('title');

        $this->assertTrue($titles->contains('Visible Course'));
        $this->assertFalse($titles->contains('Hidden Course'));

        $this->getJson('/api/v1/public/courses/'.$draft->slug)->assertNotFound();
    }
}
