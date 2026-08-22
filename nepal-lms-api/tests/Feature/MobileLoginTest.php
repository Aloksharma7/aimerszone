<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Enums\UserStatus;
use App\Services\SettingsRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * The web app authenticates via a Sanctum stateful cookie session — a native
 * app cannot participate in that flow, so this is a separate, token-issuing
 * login for nepal-lms-mobile. See its docs/ARCHITECTURE.md.
 */
class MobileLoginTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_correct_credentials_issue_a_bearer_token_that_authenticates_later_requests(): void
    {
        $student = $this->makeUser(RoleKey::Student, ['password' => 'correct-password']);

        $response = $this->postJson('/api/v1/auth/mobile-login', [
            'identifier' => $student->email,
            'password' => 'correct-password',
            'device_name' => 'pixel-9-test',
        ])->assertCreated();

        $token = $response->json('data.token');
        $this->assertNotNull($token);
        $this->assertSame($student->getKey(), $response->json('data.user.id'));

        // The cookie-session guard never enters into this — the guard switch
        // to 'sanctum' (config/auth.php) must resolve a Bearer token on its
        // own, with no per-route middleware change needed.
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.user.id', $student->getKey());
    }

    public function test_wrong_password_is_rejected_without_a_token(): void
    {
        $student = $this->makeUser(RoleKey::Student, ['password' => 'correct-password']);

        $this->postJson('/api/v1/auth/mobile-login', [
            'identifier' => $student->email,
            'password' => 'wrong-password',
            'device_name' => 'pixel-9-test',
        ])->assertStatus(422);

        $this->assertSame(1, $student->fresh()->failed_login_attempts);
    }

    public function test_a_suspended_account_cannot_get_a_token(): void
    {
        $student = $this->makeUser(RoleKey::Student, ['password' => 'correct-password', 'status' => UserStatus::Suspended->value]);

        $this->postJson('/api/v1/auth/mobile-login', [
            'identifier' => $student->email,
            'password' => 'correct-password',
            'device_name' => 'pixel-9-test',
        ])
            ->assertForbidden()
            ->assertJsonPath('code', 'account_suspended');
    }

    /**
     * Credentials are correct, so this must not look like a failed login —
     * it reports the same required_action the web login would, just with no
     * token, since the mobile app has no 2FA screen yet.
     */
    public function test_a_two_factor_account_gets_no_token_but_a_clear_reason(): void
    {
        $admin = $this->makeUser(RoleKey::Admin, ['password' => 'correct-password']);
        app(SettingsRepository::class)->set('security', 'privileged_mfa', true);
        $admin->forceFill(['two_factor_secret' => encrypt('secret'), 'two_factor_confirmed_at' => now()])->save();

        $response = $this->postJson('/api/v1/auth/mobile-login', [
            'identifier' => $admin->email,
            'password' => 'correct-password',
            'device_name' => 'pixel-9-test',
        ])->assertOk();

        $this->assertNull($response->json('data.token'));
        $this->assertSame('two_factor_challenge', $response->json('data.required_action'));
    }

    public function test_logout_revokes_the_token_so_it_cannot_be_used_again(): void
    {
        $student = $this->makeUser(RoleKey::Student);
        $token = $student->createToken('pixel-9-test')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/auth/mobile-logout')
            ->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);

        // Sanctum's guard caches the user it resolved for a token on the
        // guard instance, which — unlike two real, separate HTTP requests in
        // production — persists across two simulated requests within one
        // test method. Without this, the assertion below would pass on a
        // stale cached resolution even if revocation were completely broken.
        Auth::forgetGuards();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }

    /** The web app's own cookie-session login must keep working unchanged after the guard switch. */
    public function test_the_web_session_login_still_works_after_the_default_guard_change(): void
    {
        $student = $this->makeUser(RoleKey::Student, ['password' => 'correct-password']);

        // Only this test needs to look like it came from the frontend — see
        // TestCase::actingAsFrontend()'s docblock for why it is not applied
        // to the whole class (it would break the other tests here, which
        // deliberately exercise the stateless token path instead).
        $this->actingAsFrontend();

        $this->postJson('/api/v1/auth/login', [
            'identifier' => $student->email,
            'password' => 'correct-password',
        ])->assertOk();

        $this->assertAuthenticatedAs($student->fresh(), 'web');
    }
}
