<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Baseline response headers.
 *
 * The API returns JSON, but the signed media routes serve user-uploaded files
 * inline, which is where these actually earn their place: a crafted upload must
 * not be framed, sniffed into another content type, or leak a referrer.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('X-Permitted-Cross-Domain-Policies', 'none');

        // Uploaded evidence is served from this origin; nothing on it should be
        // able to run scripts or be embedded elsewhere.
        if ($request->is('media/*')) {
            $response->headers->set(
                'Content-Security-Policy',
                "default-src 'none'; img-src 'self'; object-src 'none'; sandbox",
            );
        }

        return $response;
    }
}
