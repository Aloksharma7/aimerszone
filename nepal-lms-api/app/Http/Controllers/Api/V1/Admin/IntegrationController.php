<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\ClassSession;
use App\Models\IntegrationEvent;
use App\Models\Recording;
use App\Services\AuditLogger;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Provider connection state and the records each provider is responsible for.
 *
 * Connecting is a configuration switch, not a credential exchange: Zoom uses
 * Server-to-Server OAuth and YouTube a refresh token, both supplied through the
 * environment. This endpoint records intent and verifies reachability once the
 * API clients land in the integrations phase.
 */
class IntegrationController extends Controller
{
    public function __construct(
        protected SettingsRepository $settings,
        protected AuditLogger $audit,
    ) {}

    /** Read-only: the current connection state, for the badge shown on page load. */
    public function status(Request $request, string $provider): JsonResponse
    {
        $provider = $this->provider($provider);
        $missing = $this->missingCredentials($provider);
        $enabled = $this->settings->bool('integrations.'.$provider->value.'_enabled', false);

        return ApiResponse::item([
            'connected' => $enabled && $missing === [],
            'status' => $missing !== [] ? 'missing_credentials' : ($enabled ? 'connected' : 'disconnected'),
            'missing' => $missing,
        ]);
    }

    public function records(Request $request, string $provider): JsonResponse
    {
        $provider = $this->provider($provider);

        $rows = $provider === IntegrationProvider::Zoom
            ? $this->zoomRows()
            : $this->youtubeRows();

        return ApiResponse::collection($rows);
    }

    public function events(Request $request, string $provider): JsonResponse
    {
        $provider = $this->provider($provider);

        $events = IntegrationEvent::query()
            ->where('provider', $provider->value)
            ->orderByDesc('occurred_at')
            ->paginate($this->perPage(50));

        return ApiResponse::paginated($events, fn (IntegrationEvent $event) => [
            'id' => $event->id,
            'action' => $event->action,
            'reference' => $event->reference,
            'status' => $event->status,
            'message' => $event->message,
            'occurred_at' => $event->occurred_at->toIso8601String(),
        ]);
    }

    /** connect | disconnect | health-check */
    public function action(Request $request, string $provider, string $action): JsonResponse
    {
        $provider = $this->provider($provider);

        abort_unless(in_array($action, ['connect', 'disconnect', 'health-check'], true), 404);

        $key = 'integrations.'.$provider->value.'_enabled';

        $result = match ($action) {
            'connect' => $this->connect($provider, $key, $request),
            'disconnect' => $this->disconnect($provider, $key, $request),
            'health-check' => $this->healthCheck($provider),
        };

        $this->audit->log(
            'integration.'.str_replace('-', '_', $action),
            actor: $request->user(),
            properties: ['provider' => $provider->value, 'result' => $result['status']],
            targetLabel: ucfirst($provider->value).' integration',
        );

        return ApiResponse::item($result);
    }

    protected function connect(IntegrationProvider $provider, string $key, Request $request): array
    {
        $missing = $this->missingCredentials($provider);

        if ($missing !== []) {
            // Enabling without credentials would produce failures at class time
            // rather than here, so the switch refuses to flip.
            return [
                'connected' => false,
                'status' => 'missing_credentials',
                'missing' => $missing,
            ];
        }

        $this->settings->set('integrations', $provider->value.'_enabled', true, updatedBy: $request->user()->getKey());

        return ['connected' => true, 'status' => 'connected'];
    }

    protected function disconnect(IntegrationProvider $provider, string $key, Request $request): array
    {
        $this->settings->set('integrations', $provider->value.'_enabled', false, updatedBy: $request->user()->getKey());

        // Existing local records are kept deliberately: past sessions and
        // recordings remain valid history even with the provider switched off.
        return ['connected' => false, 'status' => 'disconnected'];
    }

    protected function healthCheck(IntegrationProvider $provider): array
    {
        $missing = $this->missingCredentials($provider);
        $enabled = $this->settings->bool('integrations.'.$provider->value.'_enabled', false);

        $recent = IntegrationEvent::query()
            ->where('provider', $provider->value)
            ->where('occurred_at', '>=', now()->subDay())
            ->get(['status']);

        $status = match (true) {
            $missing !== [] => 'missing_credentials',
            ! $enabled => 'disabled',
            $recent->isEmpty() => 'idle',
            $recent->where('status', 'failed')->isEmpty() => 'healthy',
            default => 'degraded',
        };

        IntegrationEvent::create([
            'provider' => $provider->value,
            'action' => 'health_check',
            'status' => in_array($status, ['healthy', 'idle'], true) ? 'success' : 'failed',
            'message' => 'Administrator-triggered health check: '.$status,
            'occurred_at' => now(),
        ]);

        return [
            'connected' => $enabled && $missing === [],
            'status' => $status,
            'failures_last_day' => $recent->where('status', 'failed')->count(),
        ];
    }

    /** @return array<int, string> */
    protected function missingCredentials(IntegrationProvider $provider): array
    {
        $required = $provider === IntegrationProvider::Zoom
            ? ['account_id' => 'ZOOM_ACCOUNT_ID', 'client_id' => 'ZOOM_CLIENT_ID', 'client_secret' => 'ZOOM_CLIENT_SECRET']
            : ['client_id' => 'YOUTUBE_CLIENT_ID', 'client_secret' => 'YOUTUBE_CLIENT_SECRET', 'refresh_token' => 'YOUTUBE_REFRESH_TOKEN'];

        $missing = [];

        foreach ($required as $configKey => $envName) {
            if (blank(config('services.'.$provider->value.'.'.$configKey))) {
                $missing[] = $envName;
            }
        }

        return $missing;
    }

    protected function zoomRows()
    {
        return ClassSession::query()
            ->where('provider', 'zoom')
            ->with(['batch:id,title', 'teacher:id,name'])
            ->orderByDesc('starts_at')
            ->limit(100)
            ->get()
            ->map(fn (ClassSession $session) => [
                'id' => $session->id,
                'topic' => $session->topic,
                'batch' => $session->batch?->title ?? 'Batch removed',
                'host' => $session->teacher?->name ?? 'Not assigned',
                'meeting_id' => $session->zoom_meeting_id ?? 'Not created',
                'starts_at' => $session->starts_at->toIso8601String(),
                'sync_status' => $session->zoom_sync_status,
                'fallback' => $session->fallback_active ? 'Active' : 'None',
            ]);
    }

    protected function youtubeRows()
    {
        return Recording::query()
            ->where('source', 'youtube')
            ->with('batch:id,title')
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn (Recording $recording) => [
                'id' => $recording->id,
                'title' => $recording->title,
                'batch' => $recording->batch?->title ?? 'Batch removed',
                'video_id' => $recording->youtube_video_id ?? 'Not uploaded',
                'state' => $recording->state->value,

                // Uploads default to Unlisted; a Public one is flagged rather
                // than rejected (see RecordingSyncService), so this is what
                // lets an administrator actually find and fix one.
                'is_public' => $recording->is_youtube_public,
                'access' => $recording->released_at?->isPast() && $recording->state->value === 'available'
                    ? 'Enrolled students'
                    : 'Not yet released',
                'released_at' => $recording->released_at?->toIso8601String(),
            ]);
    }

    protected function provider(string $value): IntegrationProvider
    {
        return IntegrationProvider::tryFrom($value) ?? abort(404, 'Unknown integration provider.');
    }
}
