<?php

namespace App\Http\Middleware;

use App\Services\DeviceGuard;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A suspended or locked account keeps a valid session cookie but must not be
 * able to read or change anything beyond /auth/me and /auth/logout.
 */
class EnsureAccountIsUsable
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null) {
            return $next($request);
        }

        if (! $user->isActive()) {
            return ApiResponse::error(
                'This account is suspended. Contact the institution office.',
                'account_suspended',
                403,
            );
        }

        if ($user->isLocked()) {
            return ApiResponse::error(
                'This account is temporarily locked after repeated failed sign-in attempts.',
                'account_locked',
                403,
            );
        }

        // Cheap presence signal for the admin user list; avoids a write per request.
        if ($user->last_seen_at === null || $user->last_seen_at->lt(now()->subMinutes(5))) {
            $user->forceFill(['last_seen_at' => now()])->saveQuietly();
        }

        app(DeviceGuard::class)->touch($user, $request);

        return $next($request);
    }
}
