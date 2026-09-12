<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Socialite\Contracts\Provider;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * "Login with Google" reuses the exact same session/2FA/lock/suspend rules
 * as password login (LoginController::completeLogin, LoginAttemptService) —
 * these tests exist to prove that reuse actually holds, not just that a
 * redirect happens. The routes live in routes/web.php rather than api.php on
 * purpose: Google's redirect back to /callback carries no Origin/Referer
 * that Sanctum's statefulApi() recognises as this frontend, so the session
 * would never activate there. See routes/web.php for the full reasoning.
 */
class GoogleLoginTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
        config(['services.google.client_id' => 'test-client-id']);
    }

    protected function fakeGoogleUser(?string $email, string $name = 'Ram Sharma', string $id = 'google-123', ?string $avatar = null): void
    {
        $socialiteUser = (new SocialiteUser())->map([
            'id' => $id,
            'name' => $name,
            'email' => $email,
            'nickname' => null,
            'avatar' => $avatar,
        ]);

        $provider = Mockery::mock(Provider::class);
        $provider->shouldReceive('user')->andReturn($socialiteUser);

        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);
    }

    public function test_redirect_sends_the_browser_to_google_when_configured(): void
    {
        $provider = Mockery::mock(Provider::class);
        $provider->shouldReceive('redirect')->andReturn(redirect('https://accounts.google.com/o/oauth2/auth?fake=1'));
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

        $this->get('/api/v1/auth/google/redirect')->assertRedirect('https://accounts.google.com/o/oauth2/auth?fake=1');
    }

    public function test_redirect_fails_gracefully_when_google_credentials_are_not_set(): void
    {
        config(['services.google.client_id' => null]);

        $this->get('/api/v1/auth/google/redirect')->assertRedirect('/login?error=google_not_configured');
    }

    public function test_callback_creates_a_new_student_account_on_first_sign_in(): void
    {
        $this->fakeGoogleUser('new.student@example.test', 'Nisha Thapa');

        $this->get('/api/v1/auth/google/callback')->assertRedirect('/login');

        $user = User::where('email', 'new.student@example.test')->firstOrFail();
        $this->assertTrue($user->hasRole(RoleKey::Student));
        $this->assertNotNull($user->email_verified_at);
        $this->assertAuthenticatedAs($user);
    }

    public function test_callback_signs_into_an_existing_account_matched_by_email_instead_of_duplicating_it(): void
    {
        $teacher = $this->makeUser(RoleKey::Teacher, ['email' => 'teacher@example.test']);
        $this->fakeGoogleUser('teacher@example.test', 'Someone Else');

        $this->get('/api/v1/auth/google/callback')->assertRedirect('/login');

        $this->assertSame(1, User::where('email', 'teacher@example.test')->count());
        $this->assertAuthenticatedAs($teacher->fresh());
    }

    public function test_callback_requires_two_factor_for_an_account_that_already_has_it_enabled(): void
    {
        $admin = $this->makeUser(RoleKey::Admin, ['email' => 'admin@example.test']);
        $admin->forceFill(['two_factor_secret' => encrypt('secret'), 'two_factor_confirmed_at' => now()])->save();
        $this->fakeGoogleUser('admin@example.test');

        $this->get('/api/v1/auth/google/callback')->assertRedirect('/two-factor-challenge');

        $this->assertGuest();
        $this->assertEquals($admin->getKey(), session('two_factor.pending_user_id'));
    }

    public function test_callback_rejects_a_suspended_account(): void
    {
        $this->makeUser(RoleKey::Student, ['email' => 'suspended@example.test', 'status' => UserStatus::Suspended->value]);
        $this->fakeGoogleUser('suspended@example.test');

        $this->get('/api/v1/auth/google/callback')->assertRedirect('/login?error=account_suspended');

        $this->assertGuest();
    }

    public function test_callback_redirects_with_an_error_when_google_shares_no_email(): void
    {
        $this->fakeGoogleUser(null);

        $this->get('/api/v1/auth/google/callback')->assertRedirect('/login?error=google_no_email');

        $this->assertGuest();
    }

    public function test_callback_imports_the_google_photo_for_a_new_account(): void
    {
        Storage::fake('public');
        Http::fake(['https://lh3.googleusercontent.com/fake-photo' => Http::response('fake-image-bytes', 200, ['Content-Type' => 'image/png'])]);
        $this->fakeGoogleUser('photo.student@example.test', avatar: 'https://lh3.googleusercontent.com/fake-photo');

        $this->get('/api/v1/auth/google/callback')->assertRedirect('/login');

        $user = User::where('email', 'photo.student@example.test')->firstOrFail();
        $this->assertNotNull($user->avatar_path);
        $this->assertStringEndsWith('.png', $user->avatar_path);
        Storage::disk('public')->assertExists($user->avatar_path);
    }

    public function test_callback_fills_in_the_photo_for_an_existing_account_that_has_none(): void
    {
        Storage::fake('public');
        Http::fake(['https://lh3.googleusercontent.com/fake-photo' => Http::response('fake-image-bytes', 200, ['Content-Type' => 'image/jpeg'])]);
        $student = $this->makeUser(RoleKey::Student, ['email' => 'nophoto@example.test', 'avatar_path' => null]);
        $this->fakeGoogleUser('nophoto@example.test', avatar: 'https://lh3.googleusercontent.com/fake-photo');

        $this->get('/api/v1/auth/google/callback')->assertRedirect('/login');

        $this->assertNotNull($student->fresh()->avatar_path);
    }

    public function test_callback_never_overwrites_a_photo_the_student_already_set(): void
    {
        Http::fake(['https://lh3.googleusercontent.com/fake-photo' => Http::response('fake-image-bytes', 200, ['Content-Type' => 'image/jpeg'])]);
        $student = $this->makeUser(RoleKey::Student, ['email' => 'hasphoto@example.test', 'avatar_path' => 'avatars/already-set.jpg']);
        $this->fakeGoogleUser('hasphoto@example.test', avatar: 'https://lh3.googleusercontent.com/fake-photo');

        $this->get('/api/v1/auth/google/callback')->assertRedirect('/login');

        $this->assertSame('avatars/already-set.jpg', $student->fresh()->avatar_path);
    }

    public function test_callback_still_signs_in_when_the_google_photo_fails_to_download(): void
    {
        Http::fake(['https://lh3.googleusercontent.com/fake-photo' => Http::response('', 500)]);
        $this->fakeGoogleUser('brokenphoto@example.test', avatar: 'https://lh3.googleusercontent.com/fake-photo');

        $this->get('/api/v1/auth/google/callback')->assertRedirect('/login');

        $user = User::where('email', 'brokenphoto@example.test')->firstOrFail();
        $this->assertNull($user->avatar_path);
        $this->assertAuthenticatedAs($user);
    }
}
