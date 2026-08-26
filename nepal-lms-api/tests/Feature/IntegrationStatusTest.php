<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Services\SettingsRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: the admin integrations screen showed a permanent "Active" badge
 * on page load regardless of real state — it only ever changed after the
 * administrator manually clicked Connect/Disconnect in that browser session,
 * then reverted to "Active" on the next refresh. This is the read endpoint
 * that lets the page show the truth on load instead of a hardcoded default.
 */
class IntegrationStatusTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_status_reports_missing_credentials_when_none_are_configured(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);

        $this->actingAs($superAdmin)
            ->getJson('/api/v1/admin/integrations/zoom/status')
            ->assertOk()
            ->assertJsonPath('data.connected', false)
            ->assertJsonPath('data.status', 'missing_credentials');
    }

    public function test_status_reports_connected_once_credentials_exist_and_the_switch_is_on(): void
    {
        config(['services.zoom.account_id' => 'acc', 'services.zoom.client_id' => 'id', 'services.zoom.client_secret' => 'secret']);
        app(SettingsRepository::class)->set('integrations', 'zoom_enabled', true);

        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);

        $this->actingAs($superAdmin)
            ->getJson('/api/v1/admin/integrations/zoom/status')
            ->assertOk()
            ->assertJsonPath('data.connected', true)
            ->assertJsonPath('data.status', 'connected');
    }

    /**
     * integrations.manage moved from Super-Admin-exclusive to also granted
     * to plain Admin (config/lms.php) — this used to assert the old boundary.
     */
    public function test_a_plain_admin_can_read_integration_status(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/integrations/zoom/status')
            ->assertOk();
    }
}
