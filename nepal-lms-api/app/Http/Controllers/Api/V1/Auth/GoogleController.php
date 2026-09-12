<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\LoginAttemptService;
use App\Services\UserDirectory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Throwable;

/**
 * "Login with Google" is a full browser navigation, not an XHR call — OAuth
 * requires a top-level redirect to Google and back. This ends in a redirect
 * to the frontend (relative, so it stays on whatever host the browser is
 * actually on) rather than JSON, but otherwise reuses the exact same session
 * machinery as the password login: LoginController::completeLogin() and the
 * lock/suspend/2FA checks in LoginAttemptService.
 */
class GoogleController extends Controller
{
    public function __construct(
        protected LoginController $login,
        protected LoginAttemptService $attempts,
        protected UserDirectory $directory,
        protected AuditLogger $audit,
    ) {}

    public function redirect(): RedirectResponse
    {
        if (blank(config('services.google.client_id'))) {
            return redirect('/login?error=google_not_configured');
        }

        return Socialite::driver('google')->redirect();
    }

    public function callback(Request $request): RedirectResponse
    {
        try {
            // Not stateless(): the existing session cookie carries Socialite's
            // own CSRF "state" value across the round trip to Google and
            // back, the same way it already carries the two-factor challenge
            // below across separate requests.
            $googleUser = Socialite::driver('google')->user();
        } catch (Throwable $exception) {
            return redirect('/login?error=google_failed');
        }

        $email = mb_strtolower(trim((string) $googleUser->getEmail()));

        if ($email === '') {
            return redirect('/login?error=google_no_email');
        }

        $user = User::where('email', $email)->first();

        if ($user === null) {
            $user = $this->directory->createStudent([
                'name' => $googleUser->getName() ?: $googleUser->getNickname() ?: 'Student',
                'email' => $email,
                'terms_accepted' => true,
            ]);

            // Google already verified this address; asking them to verify it
            // again would be a pointless extra step.
            $user->forceFill(['email_verified_at' => now()])->save();

            $this->audit->log('auth.registered', $user, $user, 'Registered via Google sign-in');
        }

        $this->importGoogleAvatar($user, $googleUser);

        try {
            $this->attempts->assertSignInAllowed($user);
        } catch (DomainException $exception) {
            return redirect('/login?error='.$exception->code());
        }

        if ($this->attempts->requiresTwoFactor($user)) {
            $request->session()->put('two_factor.pending_user_id', $user->getKey());
            $request->session()->put('two_factor.remember', true);

            return redirect('/two-factor-challenge');
        }

        try {
            $this->login->completeLogin($request, $user, remember: true);
        } catch (DomainException $exception) {
            return redirect('/login?error='.$exception->code());
        }

        return redirect('/login');
    }

    /**
     * Fills in the account photo from Google on sign-in — but only when
     * nothing is there yet. A student who later uploads or removes their own
     * photo through /account/avatar must not have it silently replaced by
     * Google's on their next login.
     *
     * Best-effort: a failed fetch must not break sign-in over a photo.
     */
    protected function importGoogleAvatar(User $user, SocialiteUser $googleUser): void
    {
        if ($user->avatar_path !== null) {
            return;
        }

        $avatarUrl = $googleUser->getAvatar();

        if (blank($avatarUrl)) {
            return;
        }

        try {
            $response = Http::timeout(10)->get($avatarUrl);

            if ($response->failed()) {
                return;
            }

            $extension = match ($response->header('Content-Type')) {
                'image/png' => 'png',
                'image/webp' => 'webp',
                default => 'jpg',
            };

            $path = 'avatars/'.Str::random(40).'.'.$extension;
            Storage::disk('public')->put($path, $response->body());

            $user->forceFill(['avatar_path' => $path])->save();
        } catch (Throwable) {
            // Google's photo is a nice-to-have, not a sign-in requirement.
        }
    }
}
