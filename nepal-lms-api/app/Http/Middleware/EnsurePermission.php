<?php

namespace App\Http\Middleware;

use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fine-grained gate: permission:payments.review
 *
 * Mirrors the frontend's requirePermission() calls, but the server remains the
 * authority — a hidden link in the UI is never treated as authorization.
 */
class EnsurePermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if ($user === null) {
            return ApiResponse::error('Authentication is required to continue.', 'unauthenticated', 401);
        }

        foreach ($permissions as $permission) {
            if ($user->hasPermission($permission)) {
                return $next($request);
            }
        }

        return ApiResponse::error('You do not have permission to perform this action.', 'forbidden', 403);
    }
}
