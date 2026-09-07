<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Enums\AttendanceStatus;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\ClassSession;
use App\Services\AccessGuard;
use App\Services\AuditLogger;
use App\Services\MediaLinkService;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Issues the live-class join destination.
 *
 * This is the only place a student can obtain a meeting URL, and it is issued
 * one request at a time, inside the window, for a session in a batch they hold
 * an active seat in. The teacher's host URL is never reachable from here.
 */
class ClassSessionController extends Controller
{
    public function __construct(
        protected AccessGuard $guard,
        protected SettingsRepository $settings,
        protected MediaLinkService $links,
        protected AuditLogger $audit,
    ) {}

    public function join(Request $request, string $sessionId): JsonResponse
    {
        $session = ClassSession::with('batch')->findOrFail($sessionId);

        $this->authorize('join', $session);

        $enrollment = $this->guard->enrollmentFor($request->user(), $session->batch_id);

        if ($enrollment === null) {
            throw DomainException::forbidden('Your access to this batch is not active.', 'enrollment_inactive');
        }

        if (! $session->joinWindowIsOpen(
            $this->settings->int('operations.join_window_minutes_before', 15),
            $this->settings->int('operations.join_window_minutes_after', 20),
        )) {
            throw DomainException::conflict(
                'This class is not open for joining right now.',
                'join_window_closed',
            );
        }

        // The join window alone isn't enough: the Zoom link exists from the
        // moment the class is scheduled, well before anyone actually starts
        // it. Without this, a student could join a class the teacher never
        // started, simply because the scheduled time window happens to be open.
        if ($session->status->value !== 'live') {
            throw DomainException::conflict(
                'The teacher has not started this class yet. Try again closer to the start time.',
                'class_not_started',
            );
        }

        // Manual fallback takes priority: when the provider failed, the teacher
        // publishes a replacement link and students must receive that instead.
        $url = $session->fallback_active && filled($session->fallback_join_url)
            ? $session->fallback_join_url
            : $session->zoom_join_url;

        if (blank($url)) {
            throw DomainException::conflict(
                'The class link is not ready yet. Please refresh in a moment.',
                'join_link_unavailable',
            );
        }

        $this->markPresence($session, $request);
        $this->audit->log('class.joined', $session, $request->user());

        return ApiResponse::destination($url, $this->links->expiresAt(), [
            'passcode' => $session->zoom_passcode,
            'note' => $session->fallback_active ? $session->fallback_note : null,
        ]);
    }

    /**
     * Records the join as provisional attendance. The teacher's finalized
     * register always overrides this, so an opened link is evidence, not a mark.
     */
    protected function markPresence(ClassSession $session, Request $request): void
    {
        if ($session->attendanceFinalized()) {
            return;
        }

        $late = now()->gt($session->starts_at->copy()->addMinutes(
            $this->settings->int('operations.attendance_late_minutes', 10),
        ));

        Attendance::updateOrCreate(
            ['class_session_id' => $session->getKey(), 'user_id' => $request->user()->getKey()],
            [
                'status' => $late ? AttendanceStatus::Late->value : AttendanceStatus::Present->value,
                'joined_at' => now(),
                'source' => 'join_link',
            ],
        );
    }
}
