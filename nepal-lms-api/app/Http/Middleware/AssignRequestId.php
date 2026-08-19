<?php

namespace App\Http\Middleware;

use App\Support\RequestContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Reuses the X-Request-Id sent by the Next.js server component fetcher so a
 * single page render can be traced end to end, or mints one when absent.
 */
class AssignRequestId
{
    public function handle(Request $request, Closure $next): Response
    {
        $incoming = $request->header('X-Request-Id');
        $requestId = is_string($incoming) && preg_match('/^[A-Za-z0-9\-]{8,64}$/', $incoming)
            ? $incoming
            : (string) Str::uuid();

        app(RequestContext::class)->setRequestId($requestId);
        $request->headers->set('X-Request-Id', $requestId);

        $response = $next($request);
        $response->headers->set('X-Request-Id', $requestId);

        return $response;
    }
}
