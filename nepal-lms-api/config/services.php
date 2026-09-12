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
        'download_timeout' => (int) env('ZOOM_DOWNLOAD_TIMEOUT', 1800),

        // From the Zoom Marketplace Webhook/Event Subscription app — a
        // separate app from the Server-to-Server OAuth one above. Verifies
        // that an incoming "recording.completed" call really came from Zoom.
        'webhook_secret' => env('ZOOM_WEBHOOK_SECRET_TOKEN'),
    ],

    'youtube' => [
        'client_id' => env('YOUTUBE_CLIENT_ID'),
        'client_secret' => env('YOUTUBE_CLIENT_SECRET'),
        'refresh_token' => env('YOUTUBE_REFRESH_TOKEN'),
        'channel_id' => env('YOUTUBE_CHANNEL_ID'),
        'base_url' => rtrim(env('YOUTUBE_BASE_URL', 'https://www.googleapis.com/youtube/v3'), '/'),
        'oauth_url' => env('YOUTUBE_OAUTH_URL', 'https://oauth2.googleapis.com/token'),
        'timeout' => (int) env('YOUTUBE_TIMEOUT', 15),
        'upload_timeout' => (int) env('YOUTUBE_UPLOAD_TIMEOUT', 3600),
    ],

    // "Login with Google" (Socialite). The redirect is a fixed, fully-qualified
    // URL rather than one Socialite derives from the request — the API sits
    // behind the Next.js rewrite proxy, and deriving it risks the same
    // request-host mismatch already fixed once for signed media links.
    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI'),
    ],
];
