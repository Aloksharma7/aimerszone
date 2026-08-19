<?php

namespace App\Http\Middleware;

use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Administrator-controlled maintenance switch (Settings > Operational controls).
 *
 * Reads stay available so students are not locked out of information; only
 * state-changing requests are paused. Administrators are always exempt.
 */
class EnforceMaintenanceNotice
{
    public function __construct(protected SettingsRepository $settings) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethodSafe()) {
            return $next($request);
        }

        if (! $this->settings->bool('operations.maintenance_notice', false)) {
            return $next($request);
        }

        if ($request->user()?->isAdmin()) {
            return $next($request);
        }

        // Sign-out must keep working during maintenance.
        if ($request->is('api/v1/auth/logout')) {
            return $next($request);
        }

        return ApiResponse::error(
            $this->settings->string('operations.maintenance_message', 'The portal is temporarily unavailable for scheduled maintenance.'),
            'maintenance_mode',
            503,
        );
    }
}
