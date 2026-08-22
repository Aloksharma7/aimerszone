<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Http\Resources\AuthMeResource;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\DeviceGuard;
use App\Services\LoginAttemptService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LoginController extends Controller
{
    public function __construct(
        protected AuditLogger $audit,
        protected DeviceGuard $devices,
        protected LoginAttemptService $attempts,
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

        $user = $this->attempts->verify($credentials['identifier'], $credentials['password']);

        // Second factor required for privileged roles when the administrator
        // has enabled it. The session is not authenticated until the challenge
        // passes; only a pending marker is stored.
        if ($this->attempts->requiresTwoFactor($user)) {
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
}
