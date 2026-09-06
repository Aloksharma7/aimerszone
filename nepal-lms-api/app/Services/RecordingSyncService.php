<?php

namespace App\Services;

use App\Services\Integrations\IntegrationException;
use App\Services\Integrations\YouTubeClient;

/**
 * Confirms a YouTube video exists, is safely restricted, and is done
 * processing. Shared by the teacher's manual store()/resync() actions and
 * the automatic RecheckProcessingRecordings command, so a freshly
 * auto-uploaded video and a hand-pasted one are checked identically.
 */
class RecordingSyncService
{
    public function __construct(
        protected YouTubeClient $youtube,
        protected SettingsRepository $settings,
    ) {}

    /**
     * When YouTube is not connected the recording is still saved — the
     * teacher (or the automatic pipeline) gets a warning rather than a
     * blocked workflow.
     *
     * @return array{verified: bool, not_found?: bool, public?: bool, state?: string, duration_seconds?: int, thumbnail_url?: ?string, message?: string}
     */
    public function verify(string $videoId): array
    {
        if (! $this->settings->bool('integrations.youtube_enabled', false) || ! $this->youtube->isConfigured()) {
            return [
                'verified' => false,
                'message' => 'YouTube is not connected, so this video id could not be verified.',
            ];
        }

        try {
            $video = $this->youtube->video($videoId);
        } catch (IntegrationException $exception) {
            return ['verified' => false, 'message' => 'YouTube could not be reached: '.$exception->getMessage()];
        }

        if ($video === null) {
            return ['verified' => false, 'not_found' => true, 'message' => 'No video was found for that id on the connected channel.'];
        }

        // A public video is reachable by anyone with the link, which hands
        // paid course content to the open internet — allowed by choice, not
        // blocked, but flagged so the teacher list keeps warning about it
        // until it's switched to unlisted.
        $isPublic = ! $this->youtube->isSafelyRestricted($video);

        return [
            'verified' => true,
            'public' => $isPublic,
            'state' => $video['state'],
            'duration_seconds' => $video['duration_seconds'],
            'thumbnail_url' => $video['thumbnail_url'],
            'message' => match (true) {
                $isPublic => 'This video is public on YouTube — anyone with the link can watch it, even people who never enrolled. Set it to unlisted when you can.',
                $video['state'] !== 'processed' => 'YouTube is still processing this video.',
                default => null,
            },
        ];
    }
}
