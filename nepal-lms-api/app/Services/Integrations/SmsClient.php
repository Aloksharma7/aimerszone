<?php

namespace App\Services\Integrations;

use App\Models\IntegrationEvent;
use App\Services\FeatureGate;
use App\Services\SettingsRepository;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Sends SMS through the provider configured in the admin panel.
 *
 * Email penetration among students here is low; SMS is how an institution
 * actually reaches them. Credentials are pasted by the administrator rather
 * than deployed, so switching provider never needs a release.
 *
 * Sending never throws. A failed notification must not roll back the thing it
 * was announcing — a payment stays approved even if the SMS about it did not
 * leave. Failures are recorded and visible on the integrations screen instead.
 */
class SmsClient
{
    public function __construct(
        protected SettingsRepository $settings,
        protected FeatureGate $features,
    ) {}

    public function isReady(): bool
    {
        return $this->features->sms();
    }

    /**
     * @param  string  $mobile  Nepali mobile, with or without country code.
     * @return bool Whether the provider accepted the message.
     */
    public function send(string $mobile, string $message, string $reason = 'notification'): bool
    {
        if (! $this->isReady()) {
            return false;
        }

        $to = $this->normalize($mobile);

        if ($to === null) {
            $this->record($reason, $mobile, 'failed', 'Unusable mobile number.');

            return false;
        }

        $startedAt = microtime(true);

        try {
            $response = $this->dispatch($to, $message);
        } catch (Throwable $exception) {
            $this->record($reason, $to, 'failed', $exception->getMessage(), $startedAt);

            return false;
        }

        if ($response === true) {
            $this->record($reason, $to, 'success', null, $startedAt);

            return true;
        }

        $this->record($reason, $to, 'failed', $response, $startedAt);

        return false;
    }

    /** @return true|string True on success, otherwise the provider's message. */
    protected function dispatch(string $to, string $message): bool|string
    {
        $provider = $this->settings->string('sms.provider', 'sparrow');
        $endpoint = $this->settings->string('sms.endpoint');
        $token = (string) $this->settings->get('sms.token');
        $sender = $this->settings->string('sms.sender_id');

        // Sparrow SMS is the common Nepali provider; the generic branch covers
        // anything else that accepts a simple form post.
        $payload = match ($provider) {
            'sparrow' => ['token' => $token, 'from' => $sender, 'to' => $to, 'text' => $message],
            default => ['token' => $token, 'sender' => $sender, 'to' => $to, 'message' => $message],
        };

        $response = Http::asForm()->timeout(12)->retry(2, 400, throw: false)->post($endpoint, $payload);

        if ($response->failed()) {
            return $response->json('response') ?? $response->json('message') ?? 'Provider returned status '.$response->status();
        }

        // Sparrow answers 200 with a response_code even for rejections.
        $code = $response->json('response_code');

        if ($code !== null && (int) $code !== 200) {
            return (string) ($response->json('response') ?? 'Provider rejected the message.');
        }

        return true;
    }

    /**
     * Nepali mobiles are ten digits starting with 97 or 98. The provider wants
     * the bare local number, so any 977 country prefix is stripped.
     */
    protected function normalize(string $mobile): ?string
    {
        $digits = preg_replace('/\D/', '', $mobile);

        if (str_starts_with($digits, '977')) {
            $digits = substr($digits, 3);
        }

        return preg_match('/^9[678]\d{8}$/', $digits) ? $digits : null;
    }

    protected function record(string $action, string $reference, string $status, ?string $message, ?float $startedAt = null): void
    {
        IntegrationEvent::create([
            'provider' => 'sms',
            'action' => $action,
            // Only the last four digits: an integration log should not become a
            // contact list.
            'reference' => '•••'.substr($reference, -4),
            'status' => $status,
            'message' => $message ? mb_substr($message, 0, 500) : null,
            'duration_ms' => $startedAt ? (int) min(65000, (microtime(true) - $startedAt) * 1000) : null,
            'occurred_at' => now(),
        ]);

        if ($status === 'failed') {
            Log::channel('integrations')->warning('SMS '.$action.' failed', ['message' => $message]);
        }
    }
}
