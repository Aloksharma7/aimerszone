<?php

namespace App\Console\Commands;

use App\Enums\RecordingState;
use App\Models\Recording;
use App\Services\RecordingSyncService;
use Illuminate\Console\Command;

/**
 * The automatic counterpart to the teacher's manual "Re-check" button.
 *
 * A freshly auto-uploaded recording is created in `processing` state because
 * YouTube has not finished encoding it yet — without this, nothing would
 * ever promote it to `available`, and students would never see it despite
 * the upload having fully succeeded.
 */
class RecheckProcessingRecordings extends Command
{
    protected $signature = 'lms:recheck-processing-recordings';

    protected $description = 'Promote YouTube recordings from processing to available once YouTube finishes encoding them.';

    public function handle(RecordingSyncService $sync): int
    {
        $promoted = 0;
        $stillProcessing = 0;

        Recording::query()
            ->where('source', 'youtube')
            ->where('state', RecordingState::Processing->value)
            ->whereNotNull('youtube_video_id')
            ->chunkById(50, function ($recordings) use ($sync, &$promoted, &$stillProcessing) {
                foreach ($recordings as $recording) {
                    $result = $sync->verify($recording->youtube_video_id);

                    if (! ($result['verified'] ?? false)) {
                        // Not found / unreachable / not connected — leave it
                        // as-is, the next run tries again.
                        $stillProcessing++;

                        continue;
                    }

                    if (($result['state'] ?? null) !== 'processed') {
                        $stillProcessing++;

                        continue;
                    }

                    $recording->fill([
                        'thumbnail_url' => $result['thumbnail_url'] ?? $recording->thumbnail_url,
                        'duration_seconds' => $result['duration_seconds'] ?? $recording->duration_seconds,
                        'state' => RecordingState::Available->value,
                        'sync_message' => $result['message'] ?? null,
                        'is_youtube_public' => $result['public'] ?? false,
                        'synced_at' => now(),
                    ])->save();

                    $promoted++;
                }
            });

        $this->info("Promoted {$promoted} recording(s) to available; {$stillProcessing} still processing.");

        return self::SUCCESS;
    }
}
