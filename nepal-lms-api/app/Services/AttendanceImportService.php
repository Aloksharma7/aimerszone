<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Models\Attendance;
use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Services\Integrations\ClassMeetingService;
use App\Services\Integrations\IntegrationException;
use App\Services\Integrations\ZoomClient;
use Illuminate\Support\Carbon;

/**
 * Pulls the Zoom participant report and pre-fills the attendance register.
 *
 * Shared by the teacher-triggered manual import (AttendanceController) and
 * the automatic scheduled import (AutoImportZoomAttendance) so both paths
 * apply the exact same matching and lateness rules. Existing manual
 * overrides are always preserved — an import must never quietly undo a
 * decision the teacher already made.
 */
class AttendanceImportService
{
    public function __construct(
        protected ZoomClient $zoom,
        protected ClassMeetingService $meetings,
        protected SettingsRepository $settings,
    ) {}

    /**
     * $status is 'ok' once Zoom actually returned a report (even if 0 rows
     * matched an enrollment), or one of 'no_meeting' | 'api_error' |
     * 'no_report_yet' when nothing could be imported — callers branch on
     * this rather than guessing from imported/reported alone. 'no_meeting'
     * also covers Zoom telling us the meeting itself is permanently gone —
     * that is treated the same as never having had one: stop immediately,
     * do not keep retrying a report that will never exist.
     *
     * @return array{status: string, imported: int, reported: int, message: ?string}
     */
    public function importFromZoom(ClassSession $session): array
    {
        if (blank($session->zoom_meeting_id) || ! $this->meetings->enabled()) {
            return ['status' => 'no_meeting', 'imported' => 0, 'reported' => 0, 'message' => 'This class has no Zoom meeting to import from.'];
        }

        try {
            $participants = $this->zoom->participants($session->zoom_meeting_id);
        } catch (IntegrationException $exception) {
            if ($exception->status() === 404) {
                return ['status' => 'no_meeting', 'imported' => 0, 'reported' => 0, 'message' => 'Zoom no longer has a record of this meeting, so attendance cannot be imported automatically. Enter it manually.'];
            }

            return ['status' => 'api_error', 'imported' => 0, 'reported' => 0, 'message' => 'Zoom could not return the participant report: '.$exception->getMessage()];
        }

        if ($participants === []) {
            return ['status' => 'no_report_yet', 'imported' => 0, 'reported' => 0, 'message' => 'Zoom has no participant report for this class yet. Reports appear a few minutes after a meeting ends.'];
        }

        $enrollments = Enrollment::query()
            ->where('batch_id', $session->batch_id)
            ->accessible()
            ->with('user:id,name,email')
            ->get();

        $existing = Attendance::where('class_session_id', $session->getKey())
            ->get()
            ->keyBy('user_id');

        $lateAfter = $this->settings->int('operations.attendance_late_minutes', 10);
        $imported = 0;

        foreach ($enrollments as $enrollment) {
            $match = $this->matchParticipant($participants, $enrollment);

            if ($match === null) {
                continue;
            }

            $record = $existing->get($enrollment->user_id);

            // A manual decision outranks anything the provider reports.
            if ($record !== null && $record->source === 'manual') {
                continue;
            }

            $minutes = (int) round($match['duration'] / 60);
            $joinedAt = filled($match['join_time'] ?? null) ? Carbon::parse($match['join_time']) : null;

            $late = $joinedAt !== null
                ? $joinedAt->gt($session->starts_at->copy()->addMinutes($lateAfter))
                : $minutes < $lateAfter;

            Attendance::updateOrCreate(
                ['class_session_id' => $session->getKey(), 'user_id' => $enrollment->user_id],
                [
                    'enrollment_id' => $enrollment->getKey(),
                    'status' => $late ? AttendanceStatus::Late->value : AttendanceStatus::Present->value,
                    'joined_at' => $joinedAt,
                    'minutes_attended' => $minutes,
                    'note' => $match['name'],
                    'source' => 'zoom_import',
                ],
            );

            $imported++;
        }

        return ['status' => 'ok', 'imported' => $imported, 'reported' => count($participants), 'message' => null];
    }

    /**
     * Zoom reports display names, which students set themselves. Email is the
     * reliable key; the name comparison is a normalized fallback.
     *
     * @param  array<int, array{name: string, email: ?string, duration: int}>  $participants
     */
    protected function matchParticipant(array $participants, Enrollment $enrollment): ?array
    {
        $email = mb_strtolower((string) $enrollment->user?->email);
        $name = $this->normalize((string) $enrollment->user?->name);

        foreach ($participants as $participant) {
            if (filled($email) && mb_strtolower((string) $participant['email']) === $email) {
                return $participant;
            }
        }

        foreach ($participants as $participant) {
            if ($this->normalize($participant['name']) === $name) {
                return $participant;
            }
        }

        return null;
    }

    protected function normalize(string $value): string
    {
        return preg_replace('/[^a-z]/', '', mb_strtolower($value)) ?: '';
    }
}
