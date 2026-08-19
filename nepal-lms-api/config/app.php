<?php

use Illuminate\Support\Facades\Facade;

return [
    'name' => env('APP_NAME', 'Institution LMS'),
    'env' => env('APP_ENV', 'production'),
    'debug' => (bool) env('APP_DEBUG', false),
    'url' => env('APP_URL', 'http://localhost'),
    'frontend_url' => rtrim(env('FRONTEND_URL', 'http://localhost:3000'), '/'),

    // The institution operates in a single Nepali timezone. The frontend formats
    // every timestamp in Asia/Kathmandu, so the API must emit consistent ISO-8601.
    'timezone' => env('APP_TIMEZONE', 'Asia/Kathmandu'),
    'locale' => env('APP_LOCALE', 'en'),
    'fallback_locale' => 'en',
    'faker_locale' => 'en_US',
    'cipher' => 'AES-256-CBC',
    'key' => env('APP_KEY'),
    'previous_keys' => array_filter(explode(',', (string) env('APP_PREVIOUS_KEYS', ''))),

    /*
     * Root-namespace facade aliases. Laravel 11+ only registers what is listed
     * here, so omitting the key makes references like \DB:: fail at runtime.
     */
    'aliases' => Facade::defaultAliases()->toArray(),

    'maintenance' => [
        'driver' => env('APP_MAINTENANCE_DRIVER', 'file'),
        'store' => env('APP_MAINTENANCE_STORE', 'database'),
    ],
];
