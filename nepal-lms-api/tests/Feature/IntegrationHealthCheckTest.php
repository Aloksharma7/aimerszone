<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\IntegrationEvent;
use App\Services\SettingsRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: the "Health check" button computed "degraded" from any failed
 * event in the last 24 hours — including its own past health_check results,
 * and routine per-class meeting.participants quirks (a report not ready
 * yet, or an old meeting that no longer exists — already handled elsewhere
 * by AttendanceImportService giving up and asking for manual entry). Both
 * are now excluded via IntegrationEvent::scopeSignalsConnectionHealth() —
 * only failures that actually indicate the connection itself is broken
 * (meeting.create, meeting.update, token errors, etc.) should count.
 */
class IntegrationHealthCheckTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();

        config([
            'services.zoom.account_id' => 'test-account',
            'services.zoom.client_id' => 'test-client',
            'services.zoom.client_secret' => 'test-secret',
        ]);
        app(SettingsRepository::class)->set('integrations', 'zoom_enabled', true);
    }

    public function test_a_past_degraded_result_does_not_keep_reporting_degraded_on_its_own(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);

        // Simulates exactly what the old bug produced: a health_check row
        // recorded as failed because a previous check found the account
        // degraded — with no real sync failure anywhere in the window. That
        // used to make this check see its own past failure and report
        // "degraded" again; correctly excluded, there is no real activity
        // left at all, so "idle" — not "degraded" and not a fabricated
        // "healthy" — is the honest answer.
        IntegrationEvent::create([
            'provider' => 'zoom',
            'action' => 'health_check',
            'status' => 'failed',
            'message' => 'Administrator-triggered health check: degraded',
            'occurred_at' => now()->subHours(2),
        ]);

        $response = $this->actingAs($admin)
            ->postJson('/api/v1/admin/integrations/zoom/health-check')
            ->assertOk();

        $response->assertJsonPath('data.status', 'idle');
    }

    public function test_a_genuine_connection_failure_still_reports_degraded(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);

        IntegrationEvent::create([
            'provider' => 'zoom',
            'action' => 'meeting.create',
            'status' => 'failed',
            'message' => 'Zoom rejected the configured credentials.',
            'occurred_at' => now()->subHours(2),
        ]);

        $response = $this->actingAs($admin)
            ->postJson('/api/v1/admin/integrations/zoom/health-check')
            ->assertOk();

        $response->assertJsonPath('data.status', 'degraded');
    }

    public function test_an_old_dead_meetings_attendance_failure_does_not_report_degraded(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);

        IntegrationEvent::create([
            'provider' => 'zoom',
            'action' => 'meeting.participants',
            'status' => 'failed',
            'message' => 'Meeting does not exist: 123.',
            'occurred_at' => now()->subHours(2),
        ]);

        $response = $this->actingAs($admin)
            ->postJson('/api/v1/admin/integrations/zoom/health-check')
            ->assertOk();

        $response->assertJsonPath('data.status', 'idle');
    }
}
