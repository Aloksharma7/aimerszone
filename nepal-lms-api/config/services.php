<?php

return [
    'zoom' => [
        'account_id' => env('ZOOM_ACCOUNT_ID'),
        'client_id' => env('ZOOM_CLIENT_ID'),
        'client_secret' => env('ZOOM_CLIENT_SECRET'),
        'host_email' => env('ZOOM_HOST_EMAIL'),
        'base_url' => rtrim(env('ZOOM_BASE_URL', 'https://api.zoom.us/v2'), '/'),
        'oauth_url' => env('ZOOM_OAUTH_URL', 'https://zoom.us/oauth/token'),
        'timeout' => (int) env('ZOOM_TIMEOUT', 15),
    ],

    'youtube' => [
        'client_id' => env('YOUTUBE_CLIENT_ID'),
        'client_secret' => env('YOUTUBE_CLIENT_SECRET'),
        'refresh_token' => env('YOUTUBE_REFRESH_TOKEN'),
        'channel_id' => env('YOUTUBE_CHANNEL_ID'),
        'base_url' => rtrim(env('YOUTUBE_BASE_URL', 'https://www.googleapis.com/youtube/v3'), '/'),
        'oauth_url' => env('YOUTUBE_OAUTH_URL', 'https://oauth2.googleapis.com/token'),
        'timeout' => (int) env('YOUTUBE_TIMEOUT', 15),
    ],
];
