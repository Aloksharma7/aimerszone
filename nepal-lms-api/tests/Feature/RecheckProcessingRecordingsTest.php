<?php

namespace Tests\Feature;

use App\Models\Recording;
use App\Services\RecordingSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: this command left `state` alone for anything not yet
 * processed (correct — the next run should try again), but it also left
 * `sync_message` untouched, only ever refreshed by a teacher's manual
 * "Re-check". A recording stuck in processing for days showed whatever
 * message happened to be set at upload time, not why it's actually still
 * stuck (a real YouTube error, a disconnected integration, etc).
 */
class RecheckProcessingRecordingsTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_still_processing_recording_gets_a_fresh_diagnostic_message(): void
    {
        $batch = $this->makeBatch($this->makeCourse());

        $recording = Recording::create([
            'batch_id' => $batch->getKey(),
            'title' => 'Elasticity of Demand',
            'source' => 'youtube',
            'youtube_video_id' => 'dQw4w9WgXcQ',
            'state' => 'processing',
            'sync_message' => 'Stale message from the original upload attempt.',
            'synced_at' => now()->subDays(3),
        ]);

        $this->mock(RecordingSyncService::class, function ($mock) {
            $mock->shouldReceive('verify')->once()->andReturn([
                'verified' => true,
                'state' => 'still_processing',
                'message' => 'YouTube is still encoding this video.',
            ]);
        });

        $this->artisan('lms:recheck-processing-recordings')->assertSuccessful();

        $fresh = $recording->fresh();
        $this->assertSame('processing', $fresh->state->value);
        $this->assertSame('YouTube is still encoding this video.', $fresh->sync_message);
        $this->assertTrue($fresh->synced_at->gt(now()->subMinute()));
    }
}
