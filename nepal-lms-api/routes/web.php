<?php

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

require __DIR__.'/media.php';
