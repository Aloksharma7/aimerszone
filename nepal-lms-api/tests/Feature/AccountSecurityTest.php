<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Services\TwoFactorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use ReflectionMethod;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Password change, 2FA setup and "sign out everywhere else" are reached by
 * both the web app's cookie session AND the mobile app's bearer token — see
 * AuthenticationRevoker and TwoFactorController's docblock for why. These
 * were previously untested and broke with "Session store not set on
 * request." for any session-less caller.
 */
class AccountSecurityTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_token_authenticated_request_can_change_the_password_and_it_revokes_other_tokens(): void
    {
        $student = $this->makeUser(RoleKey::Student, ['password' => 'old-password-123']);
        $currentToken = $student->createToken('this-device')->plainTextToken;
        $otherToken = $student->createToken('other-device')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$currentToken}")
            ->putJson('/api/v1/account/password', [
                'current_password' => 'old-password-123',
                'password' => 'new-password-123',
                'password_confirmation' => 'new-password-123',
            ])
            ->assertOk();

        $this->assertTrue(Hash::check('new-password-123', $student->fresh()->password));

        // Sanctum's guard caches the resolved user across simulated requests
        // within one test method — see MobileLoginTest for why this matters.
        Auth::forgetGuards();

        // The token that made the request survives; every other one does not.
        $this->withHeader('Authorization', "Bearer {$currentToken}")->getJson('/api/v1/auth/me')->assertOk();
        Auth::forgetGuards();
        $this->withHeader('Authorization', "Bearer {$otherToken}")->getJson('/api/v1/auth/me')->assertStatus(401);
    }

    /** The web app's own flow — a real cookie session — must keep working unchanged. */
    public function test_a_session_authenticated_request_can_still_change_the_password(): void
    {
        $student = $this->makeUser(RoleKey::Student, ['password' => 'old-password-123']);
        $this->actingAsFrontend();

        $this->actingAs($student)->putJson('/api/v1/account/password', [
            'current_password' => 'old-password-123',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertOk();

        $this->assertTrue(Hash::check('new-password-123', $student->fresh()->password));
    }

    public function test_a_token_authenticated_request_can_set_up_two_factor(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $token = $admin->createToken('this-device')->plainTextToken;

        $setup = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/account/two-factor/setup')
            ->assertOk();

        $secret = $setup->json('data.secret');
        $this->assertNotNull($secret);
        $this->assertSame($secret, Cache::get("two_factor_pending_secret:{$admin->getKey()}"));

        $codeAt = new ReflectionMethod(TwoFactorService::class, 'codeAt');
        $code = $codeAt->invoke(app(TwoFactorService::class), $secret, (int) floor(time() / 30));

        $confirm = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/account/two-factor/setup', ['code' => $code])
            ->assertOk();

        $this->assertTrue($confirm->json('data.enabled'));
        $this->assertNotEmpty($confirm->json('data.recovery_codes'));
        $this->assertTrue($admin->fresh()->hasTwoFactorEnabled());
        $this->assertNull(Cache::get("two_factor_pending_secret:{$admin->getKey()}"), 'The pending secret must not survive confirmation.');
    }

    /**
     * The same "Session store not set on request" crash as the rest of this
     * file, in a sibling method that was missed the first time: fetching the
     * profile builds a session list and marks which one is "current" by
     * comparing against $request->session()->getId(), called unconditionally
     * even for a token-authenticated caller that has no session store at all.
     *
     * The test environment's default SESSION_DRIVER is "array", which skips
     * this code path entirely (ProfileController::sessions() short-circuits
     * unless the driver is "database") — so the driver is forced here and a
     * row is seeded into the real sessions table, or this test would pass
     * regardless of whether the bug is fixed.
     */
    public function test_a_token_authenticated_request_can_view_the_profile_with_a_session_listed(): void
    {
        config(['session.driver' => 'database']);

        $student = $this->makeUser(RoleKey::Student);
        $token = $student->createToken('this-device')->plainTextToken;

        DB::table('sessions')->insert([
            'id' => 'a-web-session-id',
            'user_id' => $student->getKey(),
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
            'payload' => base64_encode('placeholder'),
            'last_activity' => now()->timestamp,
        ]);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/account/profile')
            ->assertOk()
            ->assertJsonPath('data.id', $student->id)
            ->assertJsonPath('data.sessions.0.id', 'a-web-session-id')
            ->assertJsonPath('data.sessions.0.current', false);
    }

    public function test_a_token_authenticated_request_can_revoke_other_sessions(): void
    {
        $student = $this->makeUser(RoleKey::Student, ['password' => 'correct-password']);
        $currentToken = $student->createToken('this-device')->plainTextToken;
        $otherToken = $student->createToken('other-device')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$currentToken}")
            ->postJson('/api/v1/account/sessions/revoke-others', ['password' => 'correct-password'])
            ->assertOk()
            ->assertJsonPath('data.revoked', 1);

        Auth::forgetGuards();
        $this->withHeader('Authorization', "Bearer {$otherToken}")->getJson('/api/v1/auth/me')->assertStatus(401);
    }
}
