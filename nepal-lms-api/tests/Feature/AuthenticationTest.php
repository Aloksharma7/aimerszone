<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
        $this->actingAsFrontend();
    }

    public function test_a_student_can_sign_in_with_mobile_or_email(): void
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);

        $student = $this->makeUser(RoleKey::Student);

        $this->postJson('/api/v1/auth/login', [
            'identifier' => $student->mobile,
            'password' => 'password123',
        ])->assertOk()->assertJsonPath('data.portal_home', '/student/dashboard');

        $this->postJson('/api/v1/auth/logout')->assertOk();

        $this->postJson('/api/v1/auth/login', [
            'identifier' => $student->email,
            'password' => 'password123',
        ])->assertOk();
    }

    /**
     * An unknown identifier and a wrong password must be indistinguishable, or
     * the endpoint becomes a way to discover which numbers are registered.
     */
    public function test_login_does_not_reveal_whether_an_account_exists(): void
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);

        $student = $this->makeUser(RoleKey::Student);

        $unknown = $this->postJson('/api/v1/auth/login', [
            'identifier' => '9800000000',
            'password' => 'whatever123',
        ])->assertStatus(422);

        $wrongPassword = $this->postJson('/api/v1/auth/login', [
            'identifier' => $student->mobile,
            'password' => 'not-the-password',
        ])->assertStatus(422);

        $this->assertSame(
            $unknown->json('errors.identifier'),
            $wrongPassword->json('errors.identifier'),
        );
    }

    public function test_repeated_failures_lock_the_account(): void
    {
        // The rate limiter would answer 429 before the lockout could be
        // observed; this test is about the lockout, which is a separate control.
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);

        $student = $this->makeUser(RoleKey::Student);

        // The configured threshold is five attempts.
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', [
                'identifier' => $student->mobile,
                'password' => 'wrong-password',
            ]);
        }

        $this->assertTrue($student->fresh()->isLocked());

        $this->postJson('/api/v1/auth/login', [
            'identifier' => $student->mobile,
            'password' => 'password123',
        ])->assertForbidden()->assertJsonPath('code', 'account_locked');
    }

    public function test_a_forced_password_change_is_surfaced_as_a_required_action(): void
    {
        $staff = $this->makeUser(RoleKey::Staff, ['must_change_password' => true]);

        $this->actingAs($staff)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.required_action', 'change_password');

        $this->actingAs($staff)->postJson('/api/v1/auth/change-password', [
            'current_password' => 'password123',
            'password' => 'BrandNewPass99',
            'password_confirmation' => 'BrandNewPass99',
        ])->assertOk()->assertJsonPath('data.required_action', null);
    }

    /**
     * Regression: email_verified_at is not fillable, so writing it through
     * fill() silently dropped the change and left a newly-entered address
     * reading as already verified.
     */
    public function test_changing_the_email_clears_the_verified_status(): void
    {
        $student = $this->makeUser(RoleKey::Student);
        $student->forceFill(['email_verified_at' => now()])->save();

        $this->actingAs($student)
            ->patchJson('/api/v1/account/profile', ['email' => 'changed-'.$student->getKey().'@example.test'])
            ->assertOk();

        $this->assertNull($student->fresh()->email_verified_at, 'A new address must not inherit verification.');
    }

    public function test_registration_can_be_closed_by_the_administrator(): void
    {
        app(\App\Services\SettingsRepository::class)->set('security', 'public_registration', false);

        $this->postJson('/api/v1/auth/register', [
            'name' => 'New Student',
            'mobile' => '9812345678',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'terms_accepted' => true,
        ])->assertForbidden();

        $this->assertSame(0, User::where('mobile', '9812345678')->count());
    }
}
