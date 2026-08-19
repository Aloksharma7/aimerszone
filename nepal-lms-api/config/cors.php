<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'media/*'],
    'allowed_methods' => ['*'],

    // Credentialed requests cannot use a wildcard origin.
    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('CORS_ALLOWED_ORIGINS', env('FRONTEND_URL', 'http://localhost:3000')))
    ))),

    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => ['X-Request-Id'],
    'max_age' => 86400,
    'supports_credentials' => true,
];
