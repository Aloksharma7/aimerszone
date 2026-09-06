<?php

namespace App\Http\Controllers\Api\V1\Webhooks;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessZoomRecording;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Receives events from a Zoom Webhook/Event Subscription app — a separate
 * app in the Zoom Marketplace from the Server-to-Server OAuth one the rest
 * of ZoomClient uses. Authenticity is checked here via HMAC signature, not
 * Sanctum: Zoom is not a signed-in user and carries none of this app's
 * cookies.
 */
class ZoomWebhookController extends Controller
{
    public function handle(Request $request): JsonResponse
    {
        $payload = $request->all();
        $event = (string) ($payload['event'] ?? '');

        // Zoom's one-time endpoint verification handshake — must be answered
        // with an HMAC of the token it sent, using the same secret, before
        // Zoom will ever activate the subscription and start sending real
        // events at all.
        if ($event === 'endpoint.url_validation') {
            return $this->respondToValidation($payload);
        }

        if (! $this->hasValidSignature($request)) {
            Log::channel('integrations')->warning('Zoom webhook rejected: invalid signature', ['event' => $event]);

            abort(401, 'Invalid signature.');
        }

        if ($event === 'recording.completed') {
            ProcessZoomRecording::dispatch($payload);
        }

        // Any other subscribed event is acknowledged and ignored — Zoom
        // retries on a non-2xx response, so an unhandled event still needs a
        // success reply or it will keep resending.
        return response()->json(['received' => true]);
    }

    protected function respondToValidation(array $payload): JsonResponse
    {
        $plainToken = (string) data_get($payload, 'payload.plainToken');
        $secret = (string) config('services.zoom.webhook_secret');

        abort_if(blank($secret) || blank($plainToken), 400, 'Webhook secret is not configured.');

        return response()->json([
            'plainToken' => $plainToken,
            'encryptedToken' => hash_hmac('sha256', $plainToken, $secret),
        ]);
    }

    protected function hasValidSignature(Request $request): bool
    {
        $secret = (string) config('services.zoom.webhook_secret');

        if (blank($secret)) {
            return false;
        }

        $timestamp = (string) $request->header('x-zm-request-timestamp');
        $expected = 'v0='.hash_hmac('sha256', "v0:{$timestamp}:{$request->getContent()}", $secret);

        return hash_equals($expected, (string) $request->header('x-zm-signature'));
    }
}
