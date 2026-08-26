<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\ClassSession;
use App\Services\Integrations\ZoomClient;
use App\Services\SettingsRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: the Zoom participant import used to classify "Late" from how
 * many minutes someone stayed connected, reusing the "minutes past start
 * before you're late" setting to mean "minutes attended before you count as
 * present" instead — a different question entirely. A student who joined
 * exactly on time but left after a few minutes was marked Late (they were
 * not late — they left early, a different fact the record didn't have a way
 * to say). Zoom's own report includes each participant's real join time, so
 * import() now computes lateness from that, the same way the student's own
 * join-link path already does.
 */
class AttendanceImportTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
        app(SettingsRepository::class)->set('integrations', 'zoom_enabled', true);
    }

    public function test_import_classifies_by_when_someone_joined_not_how_long_they_stayed(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $onTimeButBrief = $this->makeUser(RoleKey::Student);
        $lateButLong = $this->makeUser(RoleKey::Student);
        $this->enroll($onTimeButBrief, $batch);
        $this->enroll($lateButLong, $batch);

        $startsAt = now()->subHour();

        $session = ClassSession::create([
            'batch_id' => $batch->getKey(),
            'teacher_id' => $teacher->getKey(),
            'topic' => 'Regular class',
            'status' => 'completed',
            'zoom_meeting_id' => 'test-meeting-id',
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->copy()->addHour(),
        ]);

        $this->mock(ZoomClient::class, function ($mock) use ($startsAt, $onTimeButBrief, $lateButLong) {
            $mock->shouldReceive('isConfigured')->andReturn(true);
            $mock->shouldReceive('participants')->once()->andReturn([
                [
                    'name' => $onTimeButBrief->name,
                    'email' => $onTimeButBrief->email,
                    'duration' => 180, // 3 minutes attended — left early
                    'join_time' => $startsAt->copy()->addMinutes(2)->toIso8601String(), // joined on time
                ],
                [
                    'name' => $lateButLong->name,
                    'email' => $lateButLong->email,
                    'duration' => 3000, // 50 minutes attended — stayed the whole class
                    'join_time' => $startsAt->copy()->addMinutes(15)->toIso8601String(), // joined 15 min late (default threshold is 10)
                ],
            ]);
        });

        $this->actingAs($teacher)
            ->postJson('/api/v1/teacher/classes/'.$session->getKey().'/attendance/import')
            ->assertOk()
            ->assertJsonPath('data.imported', 2);

        $this->assertDatabaseHas('attendances', [
            'class_session_id' => $session->getKey(),
            'user_id' => $onTimeButBrief->getKey(),
            'status' => 'present',
        ]);

        $this->assertDatabaseHas('attendances', [
            'class_session_id' => $session->getKey(),
            'user_id' => $lateButLong->getKey(),
            'status' => 'late',
        ]);
    }
}
