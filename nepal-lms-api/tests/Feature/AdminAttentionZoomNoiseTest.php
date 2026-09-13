<?php

namespace Tests\Feature;

use App\Models\IntegrationEvent;
use App\Services\AdminAttentionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: the admin dashboard's "Zoom sync warnings" card (and the
 * matching notification bell entry) counted every failed Zoom
 * IntegrationEvent in the last 24 hours — including health_check's own past
 * verdicts against itself, and meeting.participants failures for individual
 * old classes whose report is either not ready yet or permanently gone
 * (already handled by AttendanceImportService asking for manual entry,
 * surfaced separately as its own "attendance register pending" item). The
 * result was a dashboard demanding attention for things nobody could
 * actually act on. Both action types are now excluded via
 * IntegrationEvent::scopeSignalsConnectionHealth() — only failures that
 * indicate the Zoom connection itself is broken should raise this alert.
 */
class AdminAttentionZoomNoiseTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_health_check_and_dead_meeting_noise_do_not_raise_the_dashboard_warning(): void
    {
        IntegrationEvent::create([
            'provider' => 'zoom',
            'action' => 'health_check',
            'status' => 'failed',
            'message' => 'Administrator-triggered health check: degraded',
            'occurred_at' => now()->subHours(1),
        ]);

        IntegrationEvent::create([
            'provider' => 'zoom',
            'action' => 'meeting.participants',
            'status' => 'failed',
            'message' => 'Meeting does not exist: 123.',
            'occurred_at' => now()->subHours(2),
        ]);

        $items = app(AdminAttentionService::class)->items();

        $this->assertNull(collect($items)->firstWhere('id', 'zoom-warning'));
    }

    public function test_a_genuine_connection_failure_still_raises_the_dashboard_warning(): void
    {
        IntegrationEvent::create([
            'provider' => 'zoom',
            'action' => 'meeting.create',
            'status' => 'failed',
            'message' => 'Zoom rejected the configured credentials.',
            'occurred_at' => now()->subHours(1),
        ]);

        $items = app(AdminAttentionService::class)->items();

        $warning = collect($items)->firstWhere('id', 'zoom-warning');
        $this->assertNotNull($warning);
        $this->assertSame('1 Zoom sync warning', $warning['title']);
    }
}
