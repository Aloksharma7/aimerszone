<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Http\Resources\AuthMeResource;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\TwoFactorService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Completes a sign-in that stopped at the second factor. Until this passes the
 * session holds only a pending marker, never an authenticated identity.
 */
class TwoFactorChallengeController extends Controller
{
    public function __construct(
        protected TwoFactorService $twoFactor,
        protected LoginController $login,
        protected AuditLogger $audit,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required_without:recovery_code', 'nullable', 'string', 'max:12'],
            'recovery_code' => ['required_without:code', 'nullable', 'string', 'max:40'],
        ]);

        $pendingId = $request->session()->get('two_factor.pending_user_id');

        if ($pendingId === null) {
            throw DomainException::conflict('There is no sign-in waiting for a verification code.', 'no_pending_challenge');
        }

        $user = User::findOrFail($pendingId);

        $verified = $request->filled('recovery_code')
            ? $this->twoFactor->consumeRecoveryCode($user, $request->string('recovery_code')->value())
            : $this->twoFactor->verify($user, $request->string('code')->value());

        if (! $verified) {
            $this->audit->log('auth.two_factor_failed', $user, $user);

            throw ValidationException::withMessages([
                'code' => 'That verification code is not valid.',
            ]);
        }

        $remember = (bool) $request->session()->pull('two_factor.remember', false);
        $request->session()->forget('two_factor.pending_user_id');

        $this->login->completeLogin($request, $user, $remember);
        $this->audit->log('auth.two_factor_passed', $user, $user);

        return ApiResponse::item(new AuthMeResource($user->fresh()));
    }
}
