<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\TwoFactorService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

/**
 * Two-step enrollment: the first call returns a secret and QR payload, the
 * second confirms a generated code before the factor becomes active.
 *
 * The pending secret is held in the cache, keyed by user id, rather than the
 * session — the web app has a session either way, but a mobile request
 * authenticated by a bearer token has none, and this flow must work
 * identically for both.
 */
class TwoFactorController extends Controller
{
    public function __construct(
        protected TwoFactorService $twoFactor,
        protected AuditLogger $audit,
    ) {}

    public function setup(Request $request): JsonResponse
    {
        $user = $request->user();

        // Confirmation step: a code is present, so verify against the pending secret.
        if ($request->filled('code')) {
            $pending = Cache::get($this->pendingSecretKey($user));

            if ($pending === null) {
                return ApiResponse::error('Start the setup again to receive a new secret.', 'no_pending_setup', 409);
            }

            if (! $this->twoFactor->verify($user, $request->string('code')->value(), $pending)) {
                throw ValidationException::withMessages(['code' => 'That code did not match. Check your authenticator app.']);
            }

            $codes = $this->twoFactor->generateRecoveryCodes();

            $user->forceFill([
                'two_factor_secret' => $pending,
                'two_factor_recovery_codes' => $codes,
                'two_factor_confirmed_at' => now(),
            ])->save();

            Cache::forget($this->pendingSecretKey($user));
            $this->audit->log('account.two_factor_enabled', $user, $user);

            // Recovery codes are shown exactly once.
            return ApiResponse::item(['enabled' => true, 'recovery_codes' => $codes]);
        }

        $secret = $this->twoFactor->generateSecret();
        Cache::put($this->pendingSecretKey($user), $secret, now()->addMinutes(10));

        return ApiResponse::item([
            'enabled' => false,
            'secret' => $secret,
            'otpauth_url' => $this->twoFactor->provisioningUri($user, $secret),
        ])->header('Cache-Control', 'no-store, private');
    }

    protected function pendingSecretKey(User $user): string
    {
        return "two_factor_pending_secret:{$user->getKey()}";
    }
}
