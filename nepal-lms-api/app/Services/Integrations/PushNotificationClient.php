<?php

namespace App\Services\Integrations;

use App\Models\DeviceToken;
use App\Models\IntegrationEvent;
use App\Models\User;
use App\Services\FeatureGate;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Sends push notifications via Expo's push service — no provider credentials
 * needed, unlike SmsClient, since Expo's push endpoint is free and keyless.
 *
 * Sending never throws. A failed push must not roll back the thing it was
 * announcing, matching SmsClient's own guarantee.
 */
class PushNotificationClient
{
    protected const ENDPOINT = 'https://exp.host/--/api/v2/push/send';

    public function __construct(protected FeatureGate $features) {}

    public function isReady(): bool
    {
        return $this->features->push();
    }

    /** @param  array<string, mixed>  $data */
    public function sendToUser(User $user, string $title, string $body, array $data, string $reason): void
    {
        if (! $this->isReady()) {
            return;
        }

        $tokens = $user->deviceTokens()->pluck('expo_push_token', 'id');

        if ($tokens->isEmpty()) {
            return;
        }

        foreach ($tokens as $tokenId => $expoPushToken) {
            $this->dispatch($expoPushToken, $tokenId, $title, $body, $data, $reason);
        }
    }

    /** @param  array<string, mixed>  $data */
    protected function dispatch(string $expoPushToken, string $tokenId, string $title, string $body, array $data, string $reason): void
    {
        $startedAt = microtime(true);

        try {
            $response = Http::timeout(10)->post(self::ENDPOINT, [
                'to' => $expoPushToken,
                'title' => $title,
                'body' => $body,
                'data' => $data,
                'sound' => 'default',
            ]);
        } catch (Throwable $exception) {
            $this->record($reason, $expoPushToken, 'failed', $exception->getMessage(), $startedAt);

            return;
        }

        $status = $response->json('data.status');

        if ($status === 'ok') {
            $this->record($reason, $expoPushToken, 'success', null, $startedAt);

            return;
        }

        $message = $response->json('data.message') ?? $response->json('errors.0.message') ?? 'Expo rejected the notification.';
        $this->record($reason, $expoPushToken, 'failed', $message, $startedAt);

        // The device uninstalled the app or cleared its token: keeping a dead
        // token around only means every future push retries a lost cause.
        if ($response->json('data.details.error') === 'DeviceNotRegistered') {
            DeviceToken::whereKey($tokenId)->delete();
        }
    }

    protected function record(string $action, string $token, string $status, ?string $message, float $startedAt): void
    {
        IntegrationEvent::create([
            'provider' => 'push',
            'action' => $action,

            // Only the last six characters: a log should not become a list of
            // usable push tokens.
            'reference' => '•••'.substr($token, -6),
            'status' => $status,
            'message' => $message ? mb_substr($message, 0, 500) : null,
            'duration_ms' => (int) min(65000, (microtime(true) - $startedAt) * 1000),
            'occurred_at' => now(),
        ]);

        if ($status === 'failed') {
            Log::channel('integrations')->warning('Push '.$action.' failed', ['message' => $message]);
        }
    }
}
