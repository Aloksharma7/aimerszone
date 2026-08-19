<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Enums\UserStatus;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Http\Resources\AuthMeResource;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\DeviceGuard;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LoginController extends Controller
{
    public function __construct(
        protected SettingsRepository $settings,
        protected AuditLogger $audit,
        protected DeviceGuard $devices,
    ) {}

    /**
     * Students sign in with a mobile number, staff usually with an email.
     * One identifier field covers both, as the login form sends `identifier`.
     */
    public function store(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'identifier' => ['required', 'string', 'max:190'],
            'password' => ['required', 'string'],
            'remember' => ['nullable', 'boolean'],
        ]);

        $identifier = trim($credentials['identifier']);
        $user = User::query()
            ->where('email', mb_strtolower($identifier))
            ->orWhere('mobile', $identifier)
            ->orWhere('student_code', mb_strtoupper($identifier))
            ->first();

        if ($user === null || ! Hash::check($credentials['password'], $user->password)) {
            $this->recordFailure($user);

            // Identical message for unknown accounts and wrong passwords so the
            // endpoint cannot be used to enumerate registered numbers.
            throw ValidationException::withMessages([
                'identifier' => 'These sign-in details do not match our records.',
            ]);
        }

        if ($user->isLocked()) {
            throw DomainException::forbidden(
                'This account is temporarily locked. Try again after '.$user->locked_until->diffForHumans().'.',
                'account_locked',
            );
        }

        if ($user->status === UserStatus::Suspended) {
            $this->audit->log('auth.login_blocked_suspended', $user, $user);

            throw DomainException::forbidden('This account is suspended. Contact the institution office.', 'account_suspended');
        }

        // Second factor required for privileged roles when the administrator
        // has enabled it. The session is not authenticated until the challenge
        // passes; only a pending marker is stored.
        if ($this->requiresTwoFactor($user)) {
            $request->session()->put('two_factor.pending_user_id', $user->getKey());
            $request->session()->put('two_factor.remember', (bool) ($credentials['remember'] ?? false));

            return ApiResponse::item([
                'required_action' => 'two_factor_challenge',
                'portal_home' => $user->portalHome(),
            ]);
        }

        $this->completeLogin($request, $user, (bool) ($credentials['remember'] ?? false));

        return ApiResponse::item(new AuthMeResource($user->fresh()));
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();

        // Free the device slot before the session goes away.
        if ($user !== null) {
            $this->devices->releaseCurrent($user, $request);
        }

        auth()->guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($user !== null) {
            $this->audit->log('auth.logged_out', $user, $user);
        }

        return ApiResponse::message('Signed out.');
    }

    public function completeLogin(Request $request, User $user, bool $remember): void
    {
        auth()->guard('web')->login($user, $remember);
        $request->session()->regenerate();

        // After regenerate(), so the device row records the session it is
        // actually bound to. Throws when the account is at its device limit,
        // which leaves the session authenticated but immediately invalidated
        // below — hence the explicit logout on failure.
        try {
            $this->devices->register($user, $request);
        } catch (DomainException $exception) {
            auth()->guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw $exception;
        }

        $user->forceFill([
            'failed_login_attempts' => 0,
            'locked_until' => null,
            'last_login_at' => now(),
            'last_seen_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        $this->audit->log('auth.logged_in', $user, $user);
    }

    protected function requiresTwoFactor(User $user): bool
    {
        if ($user->hasTwoFactorEnabled()) {
            return true;
        }

        return $this->settings->bool('security.privileged_mfa', true)
            && $user->hasTwoFactorEnabled()
            && ! $user->hasRole('student');
    }

    /**
     * Progressive lockout using administrator-configured thresholds.
     * Unknown identifiers are ignored so no record is created for probes.
     */
    protected function recordFailure(?User $user): void
    {
        if ($user === null) {
            return;
        }

        $limit = $this->settings->int('security.failed_login_attempts', 5);
        $attempts = $user->failed_login_attempts + 1;

        $user->forceFill([
            'failed_login_attempts' => $attempts,
            'locked_until' => $attempts >= $limit
                ? now()->addMinutes($this->settings->int('security.lockout_minutes', 15))
                : $user->locked_until,
        ])->save();

        if ($attempts >= $limit) {
            $this->audit->log('auth.account_locked', $user, $user, 'Failed sign-in threshold reached');
        }
    }
}
