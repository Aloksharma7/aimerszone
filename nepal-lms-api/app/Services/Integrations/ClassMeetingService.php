<?php

namespace App\Services\Integrations;

use App\Models\ClassSession;
use App\Services\SettingsRepository;
use Illuminate\Support\Facades\Log;

/**
 * Bridges class sessions and Zoom.
 *
 * The rule throughout: a provider failure must never block teaching. If Zoom
 * cannot be reached, the session is still created and marked for manual
 * fallback, so the teacher can paste a link and the class goes ahead.
 */
class ClassMeetingService
{
    public function __construct(
        protected SettingsRepository $settings,
        protected ZoomClient $zoom,
    ) {}

    public function enabled(): bool
    {
        return $this->settings->bool('integrations.zoom_enabled', false) && $this->zoom->isConfigured();
    }

    /** Attaches a Zoom meeting to a newly created session, if possible. */
    public function provision(ClassSession $session): ClassSession
    {
        if (! $this->enabled()) {
            return $this->markFallback($session, 'Zoom is not connected. Add a manual join link for this class.');
        }

        try {
            $meeting = $this->zoom->createMeeting(
                $session->topic,
                $session->starts_at,
                (int) $session->starts_at->diffInMinutes($session->ends_at),
                $session->description,
            );

            $session->forceFill([
                'zoom_meeting_id' => $meeting['meeting_id'],
                'zoom_join_url' => $meeting['join_url'],
                'zoom_start_url' => $meeting['start_url'],
                'zoom_passcode' => $meeting['passcode'],
                'zoom_sync_status' => 'synced',
                'zoom_sync_message' => null,
                'zoom_synced_at' => now(),
                'fallback_active' => false,
            ])->save();

            return $session;
        } catch (IntegrationException $exception) {
            Log::channel('integrations')->warning('Zoom provisioning failed', [
                'session_id' => $session->getKey(),
                'message' => $exception->getMessage(),
            ]);

            return $this->markFallback($session, $exception->getMessage());
        }
    }

    /** Re-reads the meeting so the teacher can confirm current provider state. */
    public function sync(ClassSession $session): ClassSession
    {
        if (blank($session->zoom_meeting_id)) {
            return $this->provision($session);
        }

        if (! $this->enabled()) {
            return $this->markFallback($session, 'Zoom is not connected.');
        }

        try {
            $meeting = $this->zoom->getMeeting($session->zoom_meeting_id);

            $session->forceFill([
                'zoom_join_url' => $meeting['join_url'],
                'zoom_start_url' => $meeting['start_url'],
                'zoom_passcode' => $meeting['passcode'],
                'zoom_sync_status' => 'synced',
                'zoom_sync_message' => null,
                'zoom_synced_at' => now(),
            ])->save();
        } catch (IntegrationException $exception) {
            $this->markFallback($session, $exception->getMessage());
        }

        return $session->fresh();
    }

    /** Moves the meeting when a class is rescheduled. */
    public function reschedule(ClassSession $session): void
    {
        if (! $this->enabled() || blank($session->zoom_meeting_id)) {
            return;
        }

        try {
            $this->zoom->updateMeeting($session->zoom_meeting_id, [
                'start_time' => $session->starts_at->format('Y-m-d\TH:i:s'),
                'timezone' => config('app.timezone'),
                'duration' => max(5, (int) $session->starts_at->diffInMinutes($session->ends_at)),
            ]);

            $session->forceFill([
                'zoom_sync_status' => 'synced',
                'zoom_synced_at' => now(),
            ])->save();
        } catch (IntegrationException $exception) {
            $this->markFallback($session, $exception->getMessage());
        }
    }

    /**
     * Releases the provider meeting for a cancelled class.
     *
     * Best effort: if Zoom cannot be reached the class is still cancelled here,
     * and students are refused a join destination regardless, because
     * joinWindowIsOpen() already excludes cancelled sessions.
     */
    public function cancel(ClassSession $session): void
    {
        if (! $this->enabled() || blank($session->zoom_meeting_id)) {
            return;
        }

        try {
            $this->zoom->deleteMeeting($session->zoom_meeting_id);

            $session->forceFill([
                'zoom_sync_status' => 'cancelled',
                'zoom_join_url' => null,
                'zoom_start_url' => null,
                'zoom_synced_at' => now(),
            ])->save();
        } catch (IntegrationException $exception) {
            Log::channel('integrations')->warning('Zoom meeting could not be deleted', [
                'session_id' => $session->getKey(),
                'message' => $exception->getMessage(),
            ]);
        }
    }

    protected function markFallback(ClassSession $session, string $message): ClassSession
    {
        $session->forceFill([
            'zoom_sync_status' => 'failed',
            'zoom_sync_message' => mb_substr($message, 0, 500),
            'zoom_synced_at' => now(),
        ])->save();

        return $session;
    }
}
