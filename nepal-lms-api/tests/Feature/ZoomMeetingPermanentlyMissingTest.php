<?php

namespace Tests\Feature;

use App\Console\Commands\AutoImportZoomAttendance;
use App\Enums\RoleKey;
use App\Models\ClassSession;
use App\Services\AttendanceImportService;
use App\Services\Integrations\IntegrationException;
use App\Services\Integrations\ZoomClient;
use App\Services\SettingsRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression for the "186 Zoom sync warnings" report: Zoom returns the exact
 * same HTTP 404 both for "the report is not ready yet" (worth retrying) and
 * for "this meeting id will never have a report" (error code 3001 — the
 * meeting was deleted, never happened, or is otherwise permanently gone).
 * The importer used to treat both identically as "try again later", so a
 * dead meeting id got retried every 15 minutes for the full 48-hour window,
 * generating a failed log entry every single time for something that could
 * never succeed.
 */
class ZoomMeetingPermanentlyMissingTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
        app(SettingsRepository::class)->set('integrations', 'zoom_enabled', true);

        config([
            'services.zoom.account_id' => 'test-account',
            'services.zoom.client_id' => 'test-client',
            'services.zoom.client_secret' => 'test-secret',
        ]);
    }

    public function test_client_rethrows_when_zoom_says_the_meeting_does_not_exist(): void
    {
        Http::fake([
            'zoom.us/oauth/token' => Http::response(['access_token' => 'token'], 200),
            'api.zoom.us/v2/report/meetings/*/participants*' => Http::response(
                ['code' => 3001, 'message' => 'Meeting does not exist: 85872244255.'],
                404,
            ),
        ]);

        $this->expectException(IntegrationException::class);
        $this->expectExceptionMessage('Meeting does not exist: 85872244255.');

        app(ZoomClient::class)->participants('85872244255');
    }

    public function test_client_still_treats_a_plain_404_as_report_not_ready_yet(): void
    {
        Http::fake([
            'zoom.us/oauth/token' => Http::response(['access_token' => 'token'], 200),
            'api.zoom.us/v2/report/meetings/*/participants*' => Http::response(
                ['message' => 'No report found.'],
                404,
            ),
        ]);

        $this->assertSame([], app(ZoomClient::class)->participants('85872244255'));
    }

    public function test_import_stops_immediately_instead_of_bucketing_it_with_a_retryable_error(): void
    {
        $session = $this->completedSessionWithMeeting('85872244255');

        $this->mock(ZoomClient::class, function ($mock) {
            $mock->shouldReceive('isConfigured')->andReturn(true);
            $mock->shouldReceive('participants')->once()->andThrow(
                new IntegrationException('Meeting does not exist: 85872244255.', 'zoom', retryable: false, status: 404, reason: '3001'),
            );
        });

        $result = app(AttendanceImportService::class)->importFromZoom($session);

        $this->assertSame('no_meeting', $result['status']);
        $this->assertStringContainsString('Enter it manually', $result['message']);
    }

    public function test_auto_import_command_gives_up_after_one_try_instead_of_retrying_for_48_hours(): void
    {
        $session = $this->completedSessionWithMeeting('85872244255');

        $this->mock(ZoomClient::class, function ($mock) {
            $mock->shouldReceive('isConfigured')->andReturn(true);
            $mock->shouldReceive('participants')->once()->andThrow(
                new IntegrationException('Meeting does not exist: 85872244255.', 'zoom', retryable: false, status: 404, reason: '3001'),
            );
        });

        $this->artisan(AutoImportZoomAttendance::class)->assertSuccessful();

        $session->refresh();
        $this->assertNotNull($session->attendance_imported_at);
    }

    protected function completedSessionWithMeeting(string $meetingId): ClassSession
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $startsAt = now()->subHours(2);

        return ClassSession::create([
            'batch_id' => $batch->getKey(),
            'teacher_id' => $teacher->getKey(),
            'topic' => 'Regular class',
            'status' => 'completed',
            'provider' => 'zoom',
            'zoom_meeting_id' => $meetingId,
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->copy()->addHour(),
        ]);
    }
}
