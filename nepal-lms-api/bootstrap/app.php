<?php

use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\EnforceMaintenanceNotice;
use App\Http\Middleware\EnsureAccountIsUsable;
use App\Http\Middleware\EnsurePermission;
use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\HandleIdempotentRequest;
use App\Http\Middleware\InjectResponseMeta;
use App\Http\Middleware\SecurityHeaders;
use App\Support\ApiExceptionRenderer;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        /*
         * The Next.js server sits in front of this API and forwards /api,
         * /sanctum and /media. Without trusting it, Laravel builds and
         * validates signed URLs against its own bind address (127.0.0.1:8000)
         * rather than the origin the browser is actually on, so every
         * recording, PDF, payment-evidence and receipt link is unusable.
         *
         * TRUSTED_PROXIES defaults to '*' because the API is expected to be
         * unreachable except through that proxy. Narrow it if you expose the
         * API directly.
         */
        $middleware->trustProxies(
            at: env('TRUSTED_PROXIES', '*') === '*' ? '*' : explode(',', (string) env('TRUSTED_PROXIES')),
            headers: Request::HEADER_X_FORWARDED_FOR
                | Request::HEADER_X_FORWARDED_HOST
                | Request::HEADER_X_FORWARDED_PORT
                | Request::HEADER_X_FORWARDED_PROTO,
        );

        // Sanctum stateful cookie authentication for the Next.js browser client.
        $middleware->statefulApi();

        $middleware->api(prepend: [
            AssignRequestId::class,
        ]);

        // Applies to the signed media routes as well as the JSON API.
        $middleware->web(append: [SecurityHeaders::class]);
        $middleware->api(append: [SecurityHeaders::class]);

        $middleware->api(append: [
            InjectResponseMeta::class,
            EnforceMaintenanceNotice::class,
        ]);

        $middleware->alias([
            'account.usable' => EnsureAccountIsUsable::class,
            'role' => EnsureRole::class,
            'permission' => EnsurePermission::class,
            'idempotent' => HandleIdempotentRequest::class,
        ]);

        // The API is consumed by a JSON client only; never redirect to a login page.
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        ApiExceptionRenderer::register($exceptions);
    })
    ->create();
