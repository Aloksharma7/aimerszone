<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Ends every OTHER authenticated context for this account — other browser
 * sessions and other Sanctum tokens alike — so "sign out everywhere else"
 * means everywhere, regardless of whether the request that triggered it came
 * from the web app's cookie session or the mobile app's bearer token.
 */
class AuthenticationRevoker
{
    public function revokeOthers(Request $request, User $user): int
    {
        $removed = 0;

        if (config('session.driver') === 'database') {
            $removed += DB::table(config('session.table', 'sessions'))
                ->where('user_id', $user->getKey())
                ->when($request->hasSession(), fn ($query) => $query->where('id', '!=', $request->session()->getId()))
                ->delete();
        }

        // A session-authenticated request has no current token to protect —
        // currentAccessToken() is null there, so every token for this user
        // (there should be none anyway, but a stray one is still revoked).
        $currentToken = $user->currentAccessToken();

        $removed += $user->tokens()
            ->when($currentToken, fn ($query) => $query->where('id', '!=', $currentToken->getKey()))
            ->delete();

        return $removed;
    }
}
