<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Public-disk asset URLs (course thumbnails, payment method QR codes,
 * avatars, institution branding), returned relative to this API rather
 * than absolute.
 *
 * Storage::url() builds an absolute URL from this API's own APP_URL — a
 * different origin from wherever the frontend is actually served, so
 * next/image (and the browser, for a plain <img> tag) refuses to load it as
 * a remote source. A relative /storage/... path resolves against whatever
 * origin the frontend is on, which next.config.ts proxies through to this
 * API — the same fix already applied to signed media links.
 */
class PublicAssetUrl
{
    /** @param  string|null  $path  A public-disk path, or an already-absolute pasted URL. */
    public static function for(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        // A pasted external URL (a course thumbnail can be either an upload
        // or a CDN link) is not on this disk at all — pass it through as-is.
        if (Str::startsWith($path, ['http://', 'https://'])) {
            return $path;
        }

        $absolute = Storage::disk('public')->url($path);
        $parts = parse_url($absolute);

        return ($parts['path'] ?? '/').(isset($parts['query']) ? '?'.$parts['query'] : '');
    }

    /**
     * For consumers with no "current origin" to resolve a relative path
     * against — an email client, an SMS link, a PDF — unlike for().
     * Prefixed with the public frontend domain, the same one the reset-
     * password link itself already points at.
     */
    public static function absolute(?string $path): ?string
    {
        $relative = self::for($path);

        return $relative ? rtrim(config('app.frontend_url'), '/').$relative : null;
    }
}
