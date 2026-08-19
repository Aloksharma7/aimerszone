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
