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

require __DIR__.'/media.php';
