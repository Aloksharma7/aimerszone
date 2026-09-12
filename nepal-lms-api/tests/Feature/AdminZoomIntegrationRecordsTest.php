<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\ClassSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: the admin Zoom integrations page's "Synchronization records"
 * table read row.scheduled, row.host, row.providerState and row.localState —
 * field names that only ever existed in this page's mock data. The real
 * endpoint (IntegrationController::zoomRows()) returns starts_at,
 * sync_status and fallback, and never returned a host at all — so every
 * real row rendered "—"/"Unknown" across the board, on every session,
 * regardless of its actual sync state. IntegrationRow is typed as
 * Record<string, string>, so nothing caught the mismatch at compile time.
 * This locks in the exact field names the frontend now reads.
 */
class AdminZoomIntegrationRecordsTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_zoom_records_include_a_host_name_and_the_fields_the_admin_page_reads(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch = $this->makeBatch($this->makeCourse());

        $session = ClassSession::create([
            'batch_id' => $batch->getKey(),
            'teacher_id' => $teacher->getKey(),
            'topic' => 'Elasticity of Demand',
            'status' => 'scheduled',
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addDay()->addHour(),
            'provider' => 'zoom',
            'zoom_meeting_id' => '123456789',
            'zoom_sync_status' => 'synced',
            'zoom_synced_at' => now(),
            'fallback_active' => false,
        ]);

        $response = $this->actingAs($admin)
            ->getJson('/api/v1/admin/integrations/zoom/records')
            ->assertOk();

        $row = collect($response->json('data'))->firstWhere('id', $session->id);

        $this->assertNotNull($row);
        $this->assertSame($teacher->name, $row['host']);
        $this->assertSame($batch->title, $row['batch']);
        $this->assertSame('synced', $row['sync_status']);
        $this->assertSame('None', $row['fallback']);
        $this->assertNotEmpty($row['starts_at']);
    }

    public function test_a_session_with_no_assigned_teacher_shows_not_assigned_rather_than_a_blank_host(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $batch = $this->makeBatch($this->makeCourse());

        $session = ClassSession::create([
            'batch_id' => $batch->getKey(),
            'topic' => 'Unassigned session',
            'status' => 'scheduled',
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addDay()->addHour(),
            'provider' => 'zoom',
            'zoom_sync_status' => 'pending',
            'fallback_active' => true,
        ]);

        $response = $this->actingAs($admin)
            ->getJson('/api/v1/admin/integrations/zoom/records')
            ->assertOk();

        $row = collect($response->json('data'))->firstWhere('id', $session->id);

        $this->assertSame('Not assigned', $row['host']);
        $this->assertSame('Active', $row['fallback']);
    }
}
