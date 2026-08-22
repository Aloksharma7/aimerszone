<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\Recording;
use App\Models\Resource;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\URL;

/**
 * Builds the short-lived destinations returned by the join / playback /
 * download / proof endpoints.
 *
 * Nothing here is a permanent URL: every link is a temporary signed route that
 * re-checks authorization when it is opened, so a copied link is useless once
 * it expires or once access is revoked.
 */
class MediaLinkService
{
    public function __construct(protected SettingsRepository $settings) {}

    public function ttlSeconds(): int
    {
        return max(60, (int) config('lms.signed_url_ttl', 300));
    }

    public function expiresAt(): CarbonImmutable
    {
        return CarbonImmutable::now()->addSeconds($this->ttlSeconds());
    }

    public function forResource(Resource $resource): array
    {
        return $this->sign('media.resource', ['resource' => $resource->getKey()]);
    }

    public function forPaymentProof(Payment $payment): array
    {
        return $this->sign('media.payment-proof', ['payment' => $payment->getKey()]);
    }

    public function forReceipt(string $receiptId): array
    {
        return $this->sign('media.receipt', ['receipt' => $receiptId]);
    }

    /**
     * Uploaded recordings stream through a signed route; YouTube-hosted ones
     * return the privacy-enhanced embed origin, which the frontend validates
     * against NEXT_PUBLIC_ALLOWED_EXTERNAL_HOSTS.
     */
    public function forRecording(Recording $recording): array
    {
        if ($recording->source === 'youtube' && filled($recording->youtube_video_id)) {
            return [
                'url' => 'https://www.youtube-nocookie.com/embed/'.$recording->youtube_video_id.'?rel=0&modestbranding=1',
                'expires_at' => $this->expiresAt(),
            ];
        }

        if ($recording->source === 'link' && filled($recording->external_url)) {
            return ['url' => $recording->external_url, 'expires_at' => $this->expiresAt()];
        }

        return $this->sign('media.recording', ['recording' => $recording->getKey()]);
    }

    /**
     * Returned as a path relative to this API, not an absolute URL.
     *
     * temporarySignedRoute() builds an absolute URL from APP_URL, which is
     * this backend's own address — a different origin from the frontend the
     * browser is actually on. The frontend's trustedDestination() check
     * (deliberately) only opens same-origin or explicitly allow-listed HTTPS
     * links, so it silently refused every signed link: proof, downloads,
     * receipts, recordings all failed to open with no visible error.
     *
     * A relative /media/... path resolves against whatever origin the
     * frontend is actually running on, which next.config.ts already proxies
     * through to this API — so the signature (computed from the path and
     * query only) still verifies once the request arrives here.
     */
    protected function sign(string $route, array $parameters): array
    {
        $expiresAt = $this->expiresAt();
        $absolute = URL::temporarySignedRoute($route, $expiresAt, $parameters);
        $parts = parse_url($absolute);

        return [
            'url' => ($parts['path'] ?? '/').(isset($parts['query']) ? '?'.$parts['query'] : ''),
            'expires_at' => $expiresAt,
        ];
    }
}
