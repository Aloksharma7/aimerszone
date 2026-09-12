<?php

use App\Http\Controllers\Api\V1\Auth\GoogleController;
use Illuminate\Support\Facades\Route;

/*
 * The LMS user interface is served by the Next.js application.
 * Laravel only exposes the JSON API, Sanctum's CSRF cookie route and
 * signed media routes, so the web entry point stays intentionally small.
 */
Route::get('/', fn () => response()->json([
    'data' => [
        'service' => config('app.name').' API',
        'documentation' => 'contract/openapi.yaml',
    ],
]));

/*
 * The Zoom webhook app's OAuth redirect URL, configured only because Zoom's
 * "Add app" install flow requires one to exist — this app never uses the
 * OAuth code it receives here (webhook delivery, once installed, needs no
 * user authorization). Without a real response, that redirect 404s and the
 * app install never completes, so the webhook subscription stays inactive.
 */
Route::get('/oauth/callback', fn () => response('App installed.', 200));

/*
 * "Login with Google" — full browser navigations, not XHR. Kept out of
 * routes/api.php deliberately: Google's redirect back to /callback carries
 * no Origin/Referer that matches this app, so statefulApi()'s frontend
 * check never activates a session for it there. This file's plain "web"
 * middleware starts a session unconditionally, the same reason the signed
 * media routes below also live outside api.php. The URL still starts with
 * /api/v1 purely so the Next.js rewrite for /api/:path* forwards it here —
 * Laravel does not care which route file registered a URI.
 */
Route::middleware('throttle:auth')->prefix('api/v1/auth/google')->group(function () {
    Route::get('redirect', [GoogleController::class, 'redirect']);
    Route::get('callback', [GoogleController::class, 'callback']);
});

require __DIR__.'/media.php';
