<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use App\Services\AuthenticationRevoker;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class SessionController extends Controller
{
    public function __construct(
        protected AuditLogger $audit,
        protected AuthenticationRevoker $revoker,
    ) {}

    /** Requires the password again: this is a security-sensitive action. */
    public function revokeOthers(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'string']]);

        $user = $request->user();

        if (! Hash::check($request->string('password')->value(), $user->password)) {
            throw ValidationException::withMessages(['password' => 'The password is incorrect.']);
        }

        $removed = $this->revoker->revokeOthers($request, $user);

        $this->audit->log('account.sessions_revoked', $user, $user, properties: ['revoked' => $removed]);

        return ApiResponse::item(['revoked' => $removed]);
    }
}
