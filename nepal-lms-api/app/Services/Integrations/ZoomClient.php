<?php

namespace App\Services\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\IntegrationEvent;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Zoom Server-to-Server OAuth client.
 *
 * The access token is cached until shortly before it expires, so a class full
 * of students joining at once does not trigger a token request each time.
 * Every call is recorded in integration_events, which is what the admin
 * integration screen and the daily health check read.
 */
class ZoomClient
{
    public function __construct(protected ?string $actorId = null) {}

    public function isConfigured(): bool
    {
        return filled(config('services.zoom.account_id'))
            && filled(config('services.zoom.client_id'))
            && filled(config('services.zoom.client_secret'));
    }

    /**
     * Creates the meeting backing a class session.
     *
     * @return array{meeting_id: string, join_url: string, start_url: string, passcode: ?string}
     */
    public function createMeeting(string $topic, \DateTimeInterface $startsAt, int $durationMinutes, ?string $agenda = null): array
    {
        $payload = [
            'topic' => mb_substr($topic, 0, 200),
            'type' => 2, // scheduled
            'start_time' => $startsAt->format('Y-m-d\TH:i:s'),
            'timezone' => config('app.timezone'),
            'duration' => max(5, $durationMinutes),
            'agenda' => $agenda ? mb_substr($agenda, 0, 2000) : null,
            'settings' => [
                'join_before_host' => false,
                'waiting_room' => false,

                // Students are authenticated by us, not by Zoom.
                'meeting_authentication' => false,

                'mute_upon_entry' => true,
                'auto_recording' => config('lms.settings.integrations.zoom_auto_recording', 'cloud'),
            ],
        ];

        $response = $this->call('post', '/users/'.$this->hostIdentifier().'/meetings', $payload, 'meeting.create', $topic);

        return $this->meetingPayload($response);
    }

    public function updateMeeting(string $meetingId, array $changes): void
    {
        $this->call('patch', "/meetings/{$meetingId}", $changes, 'meeting.update', $meetingId);
    }

    public function deleteMeeting(string $meetingId): void
    {
        $this->call('delete', "/meetings/{$meetingId}", [], 'meeting.delete', $meetingId);
    }

    /** @return array{meeting_id: string, join_url: string, start_url: string, passcode: ?string, status: string} */
    public function getMeeting(string $meetingId): array
    {
        $response = $this->call('get', "/meetings/{$meetingId}", [], 'meeting.read', $meetingId);

        return $this->meetingPayload($response) + ['status' => $response->json('status', 'waiting')];
    }

    /**
     * Zoom's own error code for "this meeting id has no report and never will"
     * (deleted, never happened, or wrong id) — distinct from a plain 404 for a
     * report that just hasn't been generated yet, which Zoom returns the exact
     * same HTTP status for. Without checking this, a permanently-missing
     * meeting looked identical to "check back later" and got retried for the
     * full 48-hour window instead of failing once and asking for manual entry.
     */
    protected const MEETING_NOT_FOUND_CODE = '3001';

    /**
     * Participant report for attendance import.
     *
     * Only available after a meeting has ended, and only on paid Zoom plans;
     * a plain 404 here means "no report yet", not a failure — but see
     * MEETING_NOT_FOUND_CODE above for the one 404 that is a real, permanent
     * failure and must not be swallowed the same way.
     *
     * @return array<int, array{name: string, email: ?string, duration: int}>
     */
    public function participants(string $meetingId): array
    {
        try {
            $response = $this->call('get', "/report/meetings/{$meetingId}/participants?page_size=300", [], 'meeting.participants', $meetingId);
        } catch (IntegrationException $exception) {
            if ($exception->status() === 404 && $exception->reason() === self::MEETING_NOT_FOUND_CODE) {
                throw $exception;
            }

            if ($exception->status() === 404) {
                return [];
            }

            throw $exception;
        }

        return collect($response->json('participants', []))
            ->map(fn (array $participant) => [
                'name' => (string) ($participant['name'] ?? 'Unknown participant'),
                'email' => $participant['user_email'] ?? null,
                'duration' => (int) ($participant['duration'] ?? 0),

                // When present, lets the import compute "joined late" the same
                // way the student's own join link does, instead of guessing
                // lateness from how long they stayed.
                'join_time' => $participant['join_time'] ?? null,
            ])
            ->all();
    }

    /**
     * Streams a completed cloud recording straight to disk.
     *
     * Uses Guzzle's `sink` option so the response body is written to the file
     * as it arrives rather than buffered in PHP memory — a multi-hour class
     * recording can be hundreds of megabytes, easily enough to exhaust a
     * typical PHP memory limit if read into a string first.
     *
     * Deliberately does NOT attach the Server-to-Server OAuth bearer token:
     * Zoom authenticates a webhook-delivered recording download purely via
     * the short-lived `download_token` already embedded in $downloadUrl's
     * query string (see ProcessZoomRecording), which needs no extra scope on
     * the OAuth app at all. Sending both caused Zoom to reject the request
     * with 401 rather than honoring the valid download token.
     */
    public function downloadRecordingFile(string $downloadUrl, string $destinationPath): void
    {
        $startedAt = microtime(true);

        try {
            $response = Http::timeout((int) config('services.zoom.download_timeout', 1800))
                ->withOptions(['sink' => $destinationPath])
                ->get($downloadUrl);
        } catch (Throwable $exception) {
            @unlink($destinationPath);
            $this->record('recording.download', $destinationPath, 'failed', $exception->getMessage(), $startedAt);

            throw new IntegrationException('Zoom recording download failed.', 'zoom', retryable: true);
        }

        if ($response->failed()) {
            // The sink option writes as bytes arrive, so a failed response can
            // still leave a partial, unusable file behind.
            @unlink($destinationPath);
            $this->record('recording.download', $destinationPath, 'failed', 'status '.$response->status(), $startedAt);

            throw new IntegrationException(
                'Zoom recording download returned status '.$response->status(),
                'zoom',
                retryable: $response->serverError(),
                status: $response->status(),
            );
        }

        $this->record('recording.download', $destinationPath, 'success', null, $startedAt);
    }

    /* ----------------------------------------------------------------
     | Transport
     | ---------------------------------------------------------------- */

    protected function meetingPayload(Response $response): array
    {
        return [
            'meeting_id' => (string) $response->json('id'),
            'join_url' => (string) $response->json('join_url'),

            // Host URL: never persisted anywhere a student can read.
            'start_url' => (string) $response->json('start_url'),

            'passcode' => $response->json('password'),
        ];
    }

    protected function hostIdentifier(): string
    {
        return config('services.zoom.host_email') ?: 'me';
    }

    protected function call(string $method, string $path, array $payload, string $action, ?string $reference = null): Response
    {
        if (! $this->isConfigured()) {
            throw new IntegrationException('Zoom credentials are not configured.', 'zoom', retryable: false);
        }

        $startedAt = microtime(true);

        try {
            $response = $this->request()->{$method}(
                config('services.zoom.base_url').$path,
                array_filter($payload, fn ($value) => $value !== null),
            );
        } catch (Throwable $exception) {
            $this->record($action, $reference, 'failed', $exception->getMessage(), $startedAt);

            throw new IntegrationException(
                'Zoom could not be reached. Use the manual fallback link if the class is starting.',
                'zoom',
                retryable: true,
            );
        }

        if ($response->failed()) {
            $message = $response->json('message') ?? 'Zoom returned status '.$response->status();

            $this->record($action, $reference, 'failed', $message, $startedAt, ['status' => $response->status()]);

            // 401/403 mean the credentials are wrong; retrying will not help,
            // so the cached token is dropped and the caller is told to stop.
            if (in_array($response->status(), [401, 403], true)) {
                Cache::forget($this->tokenCacheKey());
            }

            throw new IntegrationException(
                $message,
                'zoom',
                retryable: $response->serverError() || $response->status() === 429,
                status: $response->status(),
                reason: $response->json('code') !== null ? (string) $response->json('code') : null,
            );
        }

        $this->record($action, $reference, 'success', null, $startedAt);

        return $response;
    }

    protected function request(): PendingRequest
    {
        return Http::withToken($this->accessToken())
            ->acceptJson()
            ->timeout((int) config('services.zoom.timeout', 15))

            // One quick retry absorbs a transient network blip without making
            // a teacher wait through a long backoff before class.
            ->retry(2, 300, fn ($exception, $request) => true, throw: false);
    }

    /** Cached until 60s before expiry so a call never races the refresh. */
    protected function accessToken(): string
    {
        return Cache::remember($this->tokenCacheKey(), now()->addMinutes(50), function (): string {
            $response = Http::asForm()
                ->withBasicAuth(config('services.zoom.client_id'), config('services.zoom.client_secret'))
                ->timeout((int) config('services.zoom.timeout', 15))
                ->post(config('services.zoom.oauth_url'), [
                    'grant_type' => 'account_credentials',
                    'account_id' => config('services.zoom.account_id'),
                ]);

            if ($response->failed()) {
                throw new IntegrationException(
                    'Zoom rejected the configured credentials.',
                    'zoom',
                    retryable: false,
                    status: $response->status(),
                );
            }

            return (string) $response->json('access_token');
        });
    }

    protected function tokenCacheKey(): string
    {
        return 'integrations.zoom.token';
    }

    protected function record(string $action, ?string $reference, string $status, ?string $message, float $startedAt, array $payload = []): void
    {
        IntegrationEvent::create([
            'provider' => IntegrationProvider::Zoom->value,
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
            Log::channel('integrations')->warning('Zoom '.$action.' failed', [
                'reference' => $reference,
                'message' => $message,
            ]);
        }
    }
}
