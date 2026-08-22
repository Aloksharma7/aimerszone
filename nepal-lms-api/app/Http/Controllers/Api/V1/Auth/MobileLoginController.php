<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuthMeResource;
use App\Services\AuditLogger;
use App\Services\DeviceGuard;
use App\Services\LoginAttemptService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Token-based login for the mobile app.
 *
 * The web app authenticates via Sanctum's stateful cookie session
 * (LoginController) — a native app cannot participate in that flow, so this
 * issues a personal access token instead. See
 * nepal-lms-mobile/docs/ARCHITECTURE.md for the full rationale.
 *
 * Every check below (lockout, suspension, 2FA, device limit) is identical to
 * the web login via the shared LoginAttemptService and DeviceGuard: this is
 * a different way to *complete* a login, not a weaker one.
 */
class MobileLoginController extends Controller
{
    public function __construct(
        protected AuditLogger $audit,
        protected DeviceGuard $devices,
        protected LoginAttemptService $attempts,
    ) {}

    public function store(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'identifier' => ['required', 'string', 'max:190'],
            'password' => ['required', 'string'],

            // Sanctum stores this as the token's name; shown to the user
            // later on a "manage devices" screen the same way DeviceGuard
            // already labels a browser session.
            'device_name' => ['required', 'string', 'max:120'],
        ]);

        $user = $this->attempts->verify($credentials['identifier'], $credentials['password']);

        // Mobile has no two-factor challenge screen yet — see
        // nepal-lms-mobile/docs/ROADMAP.md Phase 1. Reported the same way the
        // web login reports it (a normal response, credentials were correct),
        // just with no token issued, rather than silently skipping a check a
        // privileged account has enabled.
        if ($this->attempts->requiresTwoFactor($user)) {
            return ApiResponse::item([
                'token' => null,
                'required_action' => 'two_factor_challenge',
                'message' => 'This account requires a two-factor code, which the mobile app cannot complete yet. Sign in on the web to finish this.',
            ]);
        }

        // Same slot as a browser session — a student cannot dodge the
        // single-device limit by switching to the app.
        $this->devices->register($user, $request);

        $token = $user->createToken($credentials['device_name'])->plainTextToken;

        $user->forceFill([
            'failed_login_attempts' => 0,
            'locked_until' => null,
            'last_login_at' => now(),
            'last_seen_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        $this->audit->log('auth.logged_in', $user, $user, properties: ['client' => 'mobile']);

        return ApiResponse::item(array_merge(
            ['token' => $token],
            (new AuthMeResource($user->fresh()))->toArray($request),
        ), status: 201);
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user !== null) {
            $this->devices->releaseCurrent($user, $request);
            $user->currentAccessToken()->delete();
            $this->audit->log('auth.logged_out', $user, $user, properties: ['client' => 'mobile']);
        }

        return ApiResponse::message('Signed out.');
    }
}
