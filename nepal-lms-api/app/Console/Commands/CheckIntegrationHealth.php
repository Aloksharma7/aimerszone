<?php

namespace App\Console\Commands;

use App\Enums\IntegrationProvider;
use App\Models\IntegrationEvent;
use App\Services\Integrations\IntegrationException;
use App\Services\Integrations\YouTubeClient;
use App\Services\Integrations\ZoomClient;
use App\Services\SettingsRepository;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Daily reachability probe for each connected provider.
 *
 * Its purpose is to surface a broken credential the morning it breaks rather
 * than at the start of a live class. Controlled by the administrator's
 * "daily integration health check" switch.
 */
class CheckIntegrationHealth extends Command
{
    protected $signature = 'lms:check-integration-health';

    protected $description = 'Verify that connected integrations still authenticate.';

    public function handle(SettingsRepository $settings, ZoomClient $zoom, YouTubeClient $youtube): int
    {
        if (! $settings->bool('operations.daily_integration_health_check', true)) {
            $this->line('Daily health check is switched off.');

            return self::SUCCESS;
        }

        $this->probe(
            IntegrationProvider::Zoom,
            $settings->bool('integrations.zoom_enabled', false) && $zoom->isConfigured(),
            fn () => $zoom->isConfigured(),
        );

        $this->probe(
            IntegrationProvider::Youtube,
            $settings->bool('integrations.youtube_enabled', false) && $youtube->isConfigured(),
            fn () => $youtube->isConfigured(),
        );

        return self::SUCCESS;
    }

    protected function probe(IntegrationProvider $provider, bool $enabled, callable $check): void
    {
        if (! $enabled) {
            $this->line($provider->value.': not connected, skipped.');

            return;
        }

        try {
            $healthy = (bool) $check();
            $message = $healthy ? null : 'Credentials are incomplete.';
        } catch (IntegrationException $exception) {
            $healthy = false;
            $message = $exception->getMessage();
        }

        IntegrationEvent::create([
            'provider' => $provider->value,
            'action' => 'health_check',
            'status' => $healthy ? 'success' : 'failed',
            'message' => $message,
            'occurred_at' => now(),
        ]);

        if (! $healthy) {
            Log::channel('integrations')->error($provider->value.' health check failed', ['message' => $message]);
            $this->error($provider->value.': '.$message);

            return;
        }

        $this->info($provider->value.': healthy.');
    }
}
