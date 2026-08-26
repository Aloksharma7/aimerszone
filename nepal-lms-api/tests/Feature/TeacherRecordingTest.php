<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\Recording;
use App\Models\RecordingProgress;
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
