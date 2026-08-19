<?php

namespace App\Services\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\IntegrationEvent;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * YouTube Data API v3 client using an OAuth refresh token.
 *
 * The LMS does not upload video: recordings are uploaded to the institution's
 * channel as unlisted, and this client verifies the video exists, reads its
 * duration and processing state, and manages playlist membership. That keeps
 * large media off the application server entirely.
 */
class YouTubeClient
{
    public function __construct(protected ?string $actorId = null) {}

    public function isConfigured(): bool
    {
        return filled(config('services.youtube.client_id'))
            && filled(config('services.youtube.client_secret'))
            && filled(config('services.youtube.refresh_token'));
    }

    /**
     * Confirms a video id is real and readable, and returns what the recording
     * record needs. Returns null when the id does not resolve.
     *
     * @return array{video_id: string, title: string, duration_seconds: int, privacy: string, state: string, thumbnail_url: ?string}|null
     */
    public function video(string $videoId): ?array
    {
        $response = $this->call(
            'get',
            '/videos?part=snippet,contentDetails,status,processingDetails&id='.urlencode($videoId),
            [],
            'video.read',
            $videoId,
        );

        $item = $response->json('items.0');

        if ($item === null) {
            return null;
        }

        return [
            'video_id' => $videoId,
            'title' => (string) data_get($item, 'snippet.title', ''),
            'duration_seconds' => $this->parseDuration((string) data_get($item, 'contentDetails.duration', 'PT0S')),
            'privacy' => (string) data_get($item, 'status.privacyStatus', 'private'),

            // "processed" means students can actually watch it.
            'state' => (string) data_get($item, 'status.uploadStatus', 'uploaded'),

            'thumbnail_url' => data_get($item, 'snippet.thumbnails.medium.url'),
        ];
    }

    /**
     * A public video would be reachable by anyone with the link, which defeats
     * paid access. Unlisted is the intended state.
     */
    public function isSafelyRestricted(array $video): bool
    {
        return in_array($video['privacy'] ?? '', ['unlisted', 'private'], true);
    }

    public function addToPlaylist(string $playlistId, string $videoId): void
    {
        $this->call('post', '/playlistItems?part=snippet', [
            'snippet' => [
                'playlistId' => $playlistId,
                'resourceId' => ['kind' => 'youtube#video', 'videoId' => $videoId],
            ],
        ], 'playlist.add', $videoId);
    }

    /** ISO-8601 duration (PT1H2M3S) to seconds. */
    protected function parseDuration(string $iso): int
    {
        if (! preg_match('/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/', $iso, $matches)) {
            return 0;
        }

        return ((int) ($matches[1] ?? 0) * 86400)
            + ((int) ($matches[2] ?? 0) * 3600)
            + ((int) ($matches[3] ?? 0) * 60)
            + (int) ($matches[4] ?? 0);
    }

    protected function call(string $method, string $path, array $payload, string $action, ?string $reference = null): Response
    {
        if (! $this->isConfigured()) {
            throw new IntegrationException('YouTube credentials are not configured.', 'youtube', retryable: false);
        }

        $startedAt = microtime(true);

        try {
            $request = Http::withToken($this->accessToken())
                ->acceptJson()
                ->timeout((int) config('services.youtube.timeout', 15))
                ->retry(2, 300, fn () => true, throw: false);

            $url = config('services.youtube.base_url').$path;

            $response = $method === 'get' ? $request->get($url) : $request->{$method}($url, $payload);
        } catch (Throwable $exception) {
            $this->record($action, $reference, 'failed', $exception->getMessage(), $startedAt);

            throw new IntegrationException('YouTube could not be reached.', 'youtube', retryable: true);
        }

        if ($response->failed()) {
            $message = $response->json('error.message') ?? 'YouTube returned status '.$response->status();

            $this->record($action, $reference, 'failed', $message, $startedAt, ['status' => $response->status()]);

            if (in_array($response->status(), [401, 403], true)) {
                Cache::forget($this->tokenCacheKey());
            }

            throw new IntegrationException(
                $message,
                'youtube',
                retryable: $response->serverError() || $response->status() === 429,
                status: $response->status(),
            );
        }

        $this->record($action, $reference, 'success', null, $startedAt);

        return $response;
    }

    protected function accessToken(): string
    {
        return Cache::remember($this->tokenCacheKey(), now()->addMinutes(50), function (): string {
            $response = Http::asForm()
                ->timeout((int) config('services.youtube.timeout', 15))
                ->post(config('services.youtube.oauth_url'), [
                    'client_id' => config('services.youtube.client_id'),
                    'client_secret' => config('services.youtube.client_secret'),
                    'refresh_token' => config('services.youtube.refresh_token'),
                    'grant_type' => 'refresh_token',
                ]);

            if ($response->failed()) {
                throw new IntegrationException(
                    'YouTube rejected the configured refresh token. Re-authorize the channel.',
                    'youtube',
                    retryable: false,
                    status: $response->status(),
                );
            }

            return (string) $response->json('access_token');
        });
    }

    protected function tokenCacheKey(): string
    {
        return 'integrations.youtube.token';
    }

    protected function record(string $action, ?string $reference, string $status, ?string $message, float $startedAt, array $payload = []): void
    {
        IntegrationEvent::create([
            'provider' => IntegrationProvider::Youtube->value,
            'action' => $action,
            'reference' => $reference ? mb_substr($reference, 0, 120) : null,
            'status' => $status,
            'message' => $message ? mb_substr($message, 0, 500) : null,
            'payload' => $payload ?: null,
            'duration_ms' => (int) min(65000, (microtime(true) - $startedAt) * 1000),
            'actor_id' => $this->actorId,
            'occurred_at' => now(),
        ]);

        if ($status === 'failed') {
            Log::channel('integrations')->warning('YouTube '.$action.' failed', [
                'reference' => $reference,
                'message' => $message,
            ]);
        }
    }
}
