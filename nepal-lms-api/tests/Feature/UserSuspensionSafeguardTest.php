<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: "Suspend" produced the exact same immediate access loss as
 * "Archive" (EnsureAccountIsUsable blocks every request the instant status
 * isn't Active) but had none of Archive's safeguards — a paying student
 * mid-course could be suspended with no warning via the button sitting
 * right next to the properly-guarded one. Separately, suspend/mfa-reset/
 * revoke-sessions only ever deleted database session rows, never Sanctum
 * tokens, so a suspended student's mobile app token kept working fully
 * after an action specifically meant to lock them out.
 */
class UserSuspensionSafeguardTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_suspending_a_student_with_active_access_is_refused(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $student = $this->makeUser(RoleKey::Student);
        $batch = $this->makeBatch($this->makeCourse());
        $this->enroll($student, $batch);

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/users/'.$student->getKey().'/actions/suspend', ['reason' => 'Policy violation.'])
            ->assertStatus(409)
            ->assertJsonPath('code', 'user_has_active_access');

        $this->assertSame('active', $student->fresh()->status->value);
    }

    public function test_a_student_with_no_active_access_can_still_be_suspended(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $student = $this->makeUser(RoleKey::Student);

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/users/'.$student->getKey().'/actions/suspend', ['reason' => 'Policy violation.'])
            ->assertOk();

        $this->assertSame('suspended', $student->fresh()->status->value);
    }

    public function test_suspending_a_student_revokes_their_mobile_token_too(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $student = $this->makeUser(RoleKey::Student);
        $studentToken = $student->createToken('student-phone')->plainTextToken;

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/users/'.$student->getKey().'/actions/suspend', ['reason' => 'Policy violation.'])
            ->assertOk();

        Auth::forgetGuards();
        $this->withHeader('Authorization', "Bearer {$studentToken}")->getJson('/api/v1/auth/me')->assertStatus(401);
    }
}
