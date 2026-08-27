<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\Recording;
use App\Models\RecordingProgress;
use App\Services\Integrations\YouTubeClient;
use App\Services\SettingsRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: recordings had no delete route, unlike every other
 * teacher-managed content type — a wrongly-pasted video id or a recording
 * that needed fully retracting could only be edited or hidden, never removed.
 */
class TeacherRecordingTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_teacher_can_delete_a_recording_from_their_own_batch(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $recording = Recording::create([
            'batch_id' => $batch->getKey(),
            'title' => 'Elasticity of Demand',
            'source' => 'youtube',
            'youtube_video_id' => 'dQw4w9WgXcQ',
            'state' => 'available',
            'released_at' => now()->subDay(),
        ]);

        $student = $this->makeUser(RoleKey::Student);
        RecordingProgress::create([
            'recording_id' => $recording->getKey(),
            'user_id' => $student->getKey(),
            'progress_percent' => 40,
            'last_watched_at' => now(),
        ]);

        $this->actingAs($teacher)
            ->deleteJson('/api/v1/teacher/batches/'.$batch->getKey().'/recordings/'.$recording->getKey())
            ->assertOk();

        // Soft-deleted, like every other content type here: hidden, not gone.
        $this->assertSoftDeleted('recordings', ['id' => $recording->getKey()]);
        $this->assertDatabaseHas('recording_progress', ['recording_id' => $recording->getKey()]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'recording.deleted', 'target_id' => $recording->getKey()]);

        $this->actingAs($teacher)
            ->getJson('/api/v1/teacher/batches/'.$batch->getKey().'/recordings')
            ->assertOk()
            ->assertJsonMissing(['id' => $recording->getKey()]);
    }

    /**
     * Regression: a recording saved while YouTube was still processing the
     * video (or before YouTube integration was connected) landed in
     * `processing` and stayed there forever — nothing ever re-checked it, so
     * students could never see it. resync() gives it a second chance.
     */
    public function test_a_teacher_can_resync_a_recording_stuck_in_processing(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $recording = Recording::create([
            'batch_id' => $batch->getKey(),
            'title' => 'Elasticity of Demand',
            'source' => 'youtube',
            'youtube_video_id' => 'dQw4w9WgXcQ',
            'state' => 'processing',
            'sync_message' => 'YouTube is not connected, so this video id could not be verified.',
            'synced_at' => now()->subDay(),
        ]);

        $this->actingAs($teacher)
            ->postJson('/api/v1/teacher/batches/'.$batch->getKey().'/recordings/'.$recording->getKey().'/resync')
            ->assertOk()
            ->assertJsonPath('data.id', $recording->getKey());

        $recording->refresh();

        // Still processing here (no YouTube credentials in the test
        // environment), but the point is proven: synced_at actually moved,
        // meaning the endpoint really re-ran verify() rather than being a
        // no-op — the exact capability that did not exist before this fix.
        $this->assertTrue($recording->synced_at->gt(now()->subMinute()));
        $this->assertDatabaseHas('audit_logs', ['action' => 'recording.resynced', 'target_id' => $recording->getKey()]);
    }

    /**
     * A public video is a costly mistake (paid content freely watchable by
     * anyone with the link, no enrollment needed) but not one the platform
     * blocks outright — the institution chose to allow it with a standing
     * warning rather than a hard stop, since some content is intentionally
     * public. is_youtube_public is teacher-only, so it must not leak onto
     * the shared, student-facing recording payload.
     */
    public function test_a_public_video_is_saved_and_flagged_rather_than_rejected(): void
    {
        app(SettingsRepository::class)->set('integrations', 'youtube_enabled', true);

        $this->mock(YouTubeClient::class, function ($mock) {
            $mock->shouldReceive('isConfigured')->andReturn(true);
            $mock->shouldReceive('video')->andReturn([
                'video_id' => 'dQw4w9WgXcQ',
                'title' => 'Public test video',
                'duration_seconds' => 120,
                'privacy' => 'public',
                'state' => 'processed',
                'thumbnail_url' => 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
            ]);
            $mock->shouldReceive('isSafelyRestricted')->andReturn(false);
        });

        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $response = $this->actingAs($teacher)
            ->postJson('/api/v1/teacher/batches/'.$batch->getKey().'/recordings', [
                'title' => 'Public test video',
                'youtube_video_id' => 'dQw4w9WgXcQ',
            ])
            ->assertCreated();

        $this->assertNotNull($response->json('data.warning'));

        $recording = Recording::where('youtube_video_id', 'dQw4w9WgXcQ')->firstOrFail();
        $this->assertTrue($recording->is_youtube_public);
        $this->assertSame('available', $recording->state->value);

        $this->actingAs($teacher)
            ->getJson('/api/v1/teacher/batches/'.$batch->getKey().'/recordings')
            ->assertOk()
            ->assertJsonPath('data.0.is_public_warning', true);

        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);
        $recording->update(['released_at' => now()->subMinute()]);

        $this->actingAs($student)
            ->getJson('/api/v1/student/recordings')
            ->assertOk()
            ->assertJsonMissingPath('data.0.is_public_warning');
    }

    public function test_a_teacher_cannot_delete_a_recording_from_a_batch_they_do_not_teach(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $other = $this->makeUser(RoleKey::Teacher);

        $recording = Recording::create([
            'batch_id' => $batch->getKey(),
            'title' => 'Elasticity of Demand',
            'source' => 'youtube',
            'youtube_video_id' => 'dQw4w9WgXcQ',
            'state' => 'available',
        ]);

        $this->actingAs($other)
            ->deleteJson('/api/v1/teacher/batches/'.$batch->getKey().'/recordings/'.$recording->getKey())
            ->assertNotFound();

        $this->assertDatabaseHas('recordings', ['id' => $recording->getKey()]);
    }
}
