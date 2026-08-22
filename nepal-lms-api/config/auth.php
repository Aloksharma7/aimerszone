<?php

return [
    /*
     * 'sanctum' (not 'web') is the default so the plain `auth` middleware
     * already used everywhere in routes/api.php authenticates both clients
     * through one guard: a stateful-domain request (the Next.js web app,
     * see config/sanctum.php) resolves via the existing session/cookie —
     * unchanged behavior — and anything else (the mobile app) resolves via
     * a Bearer personal-access-token instead. No route's middleware needed
     * to change for mobile auth to start working.
     */
    'defaults' => [
        'guard' => env('AUTH_GUARD', 'sanctum'),
        'passwords' => env('AUTH_PASSWORD_BROKER', 'users'),
    ],

    'guards' => [
        'web' => [
            'driver' => 'session',
            'provider' => 'users',
        ],
    ],

    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model' => App\Models\User::class,
        ],
    ],

    'passwords' => [
        'users' => [
            'provider' => 'users',
            'table' => 'password_reset_tokens',
            'expire' => 60,
            'throttle' => 60,
        ],
    ],

    'password_timeout' => 10800,
];
