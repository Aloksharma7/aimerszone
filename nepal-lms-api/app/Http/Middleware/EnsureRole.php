<?php

namespace App\Http\Middleware;

use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Portal-level gate: role:teacher,admin
 *
 * This is coarse routing only. Record-level authorization still happens in
 * policies and scoped queries; a role check is never treated as sufficient.
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if ($user === null) {
            return ApiResponse::error('Authentication is required to continue.', 'unauthenticated', 401);
        }

        if ($user->isAdmin()) {
            return $next($request);
        }

        foreach ($roles as $role) {
            if ($user->hasRole($role)) {
                return $next($request);
            }
        }

        return ApiResponse::error('This workspace is not available for your account.', 'forbidden', 403);
    }
}
