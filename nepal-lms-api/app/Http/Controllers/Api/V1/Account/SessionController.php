<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class SessionController extends Controller
{
    public function __construct(protected AuditLogger $audit) {}

    /** Requires the password again: this is a security-sensitive action. */
    public function revokeOthers(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'string']]);

        $user = $request->user();

        if (! Hash::check($request->string('password')->value(), $user->password)) {
            throw ValidationException::withMessages(['password' => 'The password is incorrect.']);
        }

        $removed = 0;

        if (config('session.driver') === 'database') {
            $removed = DB::table(config('session.table', 'sessions'))
                ->where('user_id', $user->getKey())
                ->where('id', '!=', $request->session()->getId())
                ->delete();
        }

        $this->audit->log('account.sessions_revoked', $user, $user, properties: ['revoked' => $removed]);

        return ApiResponse::item(['revoked' => $removed]);
    }
}
