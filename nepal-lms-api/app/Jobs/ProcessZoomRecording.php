<?php

namespace App\Jobs;

use App\Enums\RecordingState;
use App\Models\ClassSession;
use App\Models\Recording;
use App\Services\Integrations\IntegrationException;
use App\Services\Integrations\YouTubeClient;
use App\Services\Integrations\ZoomClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Downloads a completed Zoom cloud recording and uploads it to YouTube as
 * unlisted, then links it to the class session automatically — the manual
 * "paste a YouTube id" step this replaces.
 *
 * Download and upload are kept as two distinct, resumable stages against the
 * same local temp file: a YouTube quota failure re-queues for the next day
 * without re-downloading from Zoom (whose own download URL/token may not
 * even be valid that long), and a transient failure in either stage retries
 * through the same file rather than starting over.
 */
class ProcessZoomRecording implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    // Deliberately high: a quota-exceeded release() counts as an attempt
    // just like a real failure does, and a busy week could need several
    // daily retries before quota frees up. A genuine, persistent failure
    // (corrupt download, permanently wrong credentials) still gives up well
    // before this and is logged in failed() for a human to notice.
    public int $tries = 20;

    // Generous: downloading and re-uploading a multi-hour recording on a
    // modest server connection can genuinely take a long time.
    public int $timeout = 3600;

    public function __construct(protected array $payload) {}

    public function handle(ZoomClient $zoom, YouTubeClient $youtube): void
    {
        $object = (array) data_get($this->payload, 'payload.object', []);
        $meetingId = (string) ($object['id'] ?? '');

        if (blank($meetingId)) {
            Log::channel('integrations')->warning('Zoom recording.completed with no meeting id in payload.');

            return;
        }

        $session = ClassSession::where('zoom_meeting_id', $meetingId)->first();

        if ($session === null) {
            // Not one of our sessions (a stray test event, or a meeting id
            // that has since changed) — nothing to link the video to, and
            // retrying will not change that.
            Log::channel('integrations')->info('Zoom recording.completed for an unrecognized meeting.', ['meeting_id' => $meetingId]);

            return;
        }

        if (Recording::where('class_session_id', $session->getKey())->exists()) {
            // A duplicate webhook delivery — Zoom resends on anything but a
            // fast 2xx, and this job may have already succeeded once.
            return;
        }

        $file = $this->pickBestFile((array) ($object['recording_files'] ?? []));

        if ($file === null) {
            Log::channel('integrations')->warning('Zoom recording.completed with no usable video file.', ['meeting_id' => $meetingId]);

            return;
        }

        $tempPath = storage_path('app/zoom-recordings/'.$session->getKey().'.mp4');

        if (! is_dir(dirname($tempPath))) {
            mkdir(dirname($tempPath), 0755, true);
        }

        if (! file_exists($tempPath)) {
            $token = data_get($this->payload, 'download_token');
            $downloadUrl = $file['download_url'].($token ? '?access_token='.$token : '');

            $zoom->downloadRecordingFile($downloadUrl, $tempPath);
        }

        try {
            $videoId = $youtube->uploadVideo(
                $tempPath,
                title: mb_strimwidth($session->topic, 0, 100, '...'),
                description: sprintf('Recorded class: %s (%s)', $session->topic, $session->batch?->title ?? 'Batch'),
            );
        } catch (IntegrationException $exception) {
            if ($exception->reason() === 'quota_exceeded') {
                // Keep $tempPath — retry the upload only, next time this job
                // runs. Google resets quota at midnight Pacific time.
                $this->release($this->secondsUntilPacificMidnight());

                return;
            }

            throw $exception;
        }

        Recording::create([
            'batch_id' => $session->batch_id,
            'class_session_id' => $session->getKey(),
            'title' => $session->topic,
            'source' => 'youtube',
            'youtube_video_id' => $videoId,
            'recorded_at' => $session->actual_started_at ?? $session->starts_at,
            'released_at' => now(),
            'state' => RecordingState::Processing->value,
            'sync_message' => 'Uploaded automatically from the Zoom recording. YouTube is still processing it.',
            'created_by' => $session->teacher_id,
        ]);

        @unlink($tempPath);
    }

    /**
     * Only a job that itself failed (ran out of retries) should ever clean up
     * the temp file on the way out — a deliberate release() for a quota
     * retry must not trigger this.
     */
    public function failed(Throwable $exception): void
    {
        $sessionId = ClassSession::where('zoom_meeting_id', (string) data_get($this->payload, 'payload.object.id'))->value('id');

        if ($sessionId !== null) {
            @unlink(storage_path('app/zoom-recordings/'.$sessionId.'.mp4'));
        }

        Log::channel('integrations')->error('ProcessZoomRecording failed permanently.', [
            'meeting_id' => data_get($this->payload, 'payload.object.id'),
            'error' => $exception->getMessage(),
        ]);
    }

    /**
     * Zoom's recording_files array includes video, audio-only, transcript
     * and chat entries — prefer the gallery/speaker composite MP4 a student
     * would actually want to watch, falling back to any playable video file.
     *
     * @param  array<int, array<string, mixed>>  $files
     * @return array{download_url: string, file_type: string}|null
     */
    protected function pickBestFile(array $files): ?array
    {
        $preferred = collect($files)->first(fn (array $file) => ($file['recording_type'] ?? null) === 'shared_screen_with_speaker_view'
            && strtoupper((string) ($file['file_type'] ?? '')) === 'MP4');

        $fallback = collect($files)->first(fn (array $file) => strtoupper((string) ($file['file_type'] ?? '')) === 'MP4');

        return $preferred ?? $fallback ?? null;
    }

    protected function secondsUntilPacificMidnight(): int
    {
        return max(60, now('America/Los_Angeles')->addDay()->startOfDay()->timestamp - now()->timestamp);
    }
}
