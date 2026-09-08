<?php

namespace App\Http\Controllers\Api\V1\Teacher;

use App\Enums\ClassSessionStatus;
use App\Enums\RecordingState;
use App\Models\Batch;
use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Models\Recording;
use App\Models\Test;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;

/**
 * Shared payload shaping and scope checks for the teacher portal.
 *
 * Every controller here goes through resolveBatch()/resolveSession(), which
 * fail with 404 rather than 403 for a batch the teacher does not teach — an
 * unassigned teacher should not be able to confirm the record exists.
 */
trait ResolvesTeacherScope
{
    protected function resolveBatch(string $batchId, $user): Batch
    {
        abort_unless($this->guard->teachesBatch($user, $batchId) || $user->isAdmin(), 404);

        return Batch::with('course:id,title')->findOrFail($batchId);
    }

    protected function resolveSession(string $sessionId, $user): ClassSession
    {
        $session = ClassSession::with(['batch.course', 'teacher'])->findOrFail($sessionId);

        abort_unless($this->guard->teachesBatch($user, $session->batch_id) || $user->isAdmin(), 404);

        return $session;
    }

    /**
     * @param ClassSession|false|null $nextSession Precomputed via nextSessionsFor()
     *        when mapping a list, so each row does not run its own query. `false`
     *        means "precomputed, and there is none" — distinct from "not precomputed".
     * @param int|null $syllabusPercent Precomputed via syllabusProgressFor().
     */
    protected function batchPayload(Batch $batch, ClassSession|false|null $nextSession = null, ?int $syllabusPercent = null): array
    {
        $next = $nextSession === null ? $batch->sessions()->upcoming()->first() : ($nextSession ?: null);

        return [
            'id' => $batch->id,
            'course_title' => $batch->course?->title ?? 'Course removed',
            'batch_title' => $batch->title,
            'students_count' => (int) ($batch->students_count ?? $batch->enrollments()->accessible()->count()),
            'schedule_summary' => $batch->schedule_summary ?? 'Schedule not set',
            'syllabus_progress_percent' => $syllabusPercent ?? $this->syllabusProgress($batch),
            'next_class_at' => $next?->starts_at?->toIso8601String(),
            'next_class_label' => $next?->topic,
            'status' => $batch->status->value,
        ];
    }

    /** One query for "next upcoming session" across many batches, instead of one per batch. */
    protected function nextSessionsFor(array $batchIds): Collection
    {
        return ClassSession::query()
            ->whereIn('batch_id', $batchIds ?: ['-'])
            ->upcoming()
            ->get()
            ->groupBy('batch_id')
            ->map(fn (Collection $sessions) => $sessions->first());
    }

    /** One query for average syllabus completion across many batches, instead of one per batch. */
    protected function syllabusProgressFor(array $batchIds): array
    {
        return Enrollment::query()
            ->whereIn('batch_id', $batchIds ?: ['-'])
            ->accessible()
            ->selectRaw('batch_id, AVG(syllabus_percent) as avg_percent')
            ->groupBy('batch_id')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->batch_id => (int) round((float) $row->avg_percent)])
            ->all();
    }

    protected function sessionPayload(ClassSession $session, ?int $studentsCount = null): array
    {
        return [
            'id' => $session->id,
            'title' => $session->topic,
            'course_title' => $session->batch?->course?->title ?? 'Course removed',
            'batch_title' => $session->batch?->title ?? 'Batch removed',
            'teacher_name' => $session->teacher?->name,
            'starts_at' => $session->starts_at->toIso8601String(),
            'ends_at' => $session->ends_at->toIso8601String(),
            'status' => $session->status->value,
            'students_count' => $studentsCount ?? $session->batch?->enrollments()->accessible()->count() ?? 0,
            'instructions' => $session->description,
            'attendance_state' => $session->attendanceFinalized() ? 'finalized' : 'pending',

            // The host link is only offered once the class is close enough to
            // start; the endpoint re-checks this independently.
            'start_available' => $this->startAvailable($session),

            // Starting a class and attesting attendance are the assigned
            // teacher's own acts, not just anyone holding the permission —
            // an admin viewing this same record on the re-exported admin
            // page needs to know that before it renders a button the
            // endpoint will now refuse.
            'can_start' => (bool) Auth::user()?->can('start', $session),
            'can_finalize_attendance' => (bool) Auth::user()?->can('finalizeAttendance', $session),
            'can_reopen_attendance' => (bool) Auth::user()?->can('reopenAttendance', $session),
        ];
    }

    protected function startAvailable(ClassSession $session): bool
    {
        if (in_array($session->status, [ClassSessionStatus::Cancelled, ClassSessionStatus::Completed], true)) {
            return false;
        }

        return now()->betweenIncluded(
            $session->starts_at->copy()->subMinutes(30),
            $session->ends_at->copy()->addMinutes(30),
        );
    }

    /** Average syllabus completion across the batch's active students. */
    protected function syllabusProgress(Batch $batch): int
    {
        return (int) round(
            Enrollment::query()
                ->where('batch_id', $batch->getKey())
                ->accessible()
                ->avg('syllabus_percent') ?? 0,
        );
    }

    /** Finished classes whose register has not been finalized. */
    protected function pendingAttendanceQuery(array $batchIds): Builder
    {
        return ClassSession::query()
            ->whereIn('batch_id', $batchIds ?: ['-'])
            ->where('ends_at', '<', now())
            ->whereNull('attendance_finalized_at')
            ->where('status', '!=', ClassSessionStatus::Cancelled->value)
            ->orderBy('ends_at');
    }

    /**
     * Concrete items the teacher still owes, most time-sensitive first.
     * Shared by the dashboard's follow-up panel and the notification bell —
     * the same outstanding-work signals, shown two ways.
     */
    protected function followUps(array $batchIds): array
    {
        $items = [];

        foreach ($this->pendingAttendanceQuery($batchIds)->with('batch')->limit(5)->get() as $session) {
            $items[] = [
                'id' => 'attendance-'.$session->id,
                'title' => 'Finalize attendance: '.$session->topic,
                'detail' => ($session->batch?->title ?? 'Batch').' · ended '.$session->ends_at->diffForHumans(),
                'href' => '/teacher/attendance',
                'type' => 'attendance',
            ];
        }

        $unreleased = Recording::query()
            ->whereIn('batch_id', $batchIds ?: ['-'])
            ->where(fn ($query) => $query->whereNull('released_at')->orWhere('state', RecordingState::Processing->value))
            ->with('batch')
            ->limit(5)
            ->get();

        foreach ($unreleased as $recording) {
            $items[] = [
                'id' => 'recording-'.$recording->id,
                'title' => 'Release recording: '.$recording->title,
                'detail' => ($recording->batch?->title ?? 'Batch').' · not yet visible to students',
                'href' => '/teacher/batches/'.$recording->batch_id.'/recordings',
                'type' => 'recording',
            ];
        }

        $drafts = Test::query()
            ->whereIn('batch_id', $batchIds ?: ['-'])
            ->where('status', 'draft')
            ->with('batch')
            ->limit(5)
            ->get();

        foreach ($drafts as $test) {
            $items[] = [
                'id' => 'test-'.$test->id,
                'title' => 'Publish test: '.$test->title,
                'detail' => ($test->batch?->title ?? 'Batch').' · still a draft',
                'href' => '/teacher/tests/'.$test->id,
                'type' => 'test',
            ];
        }

        return array_slice($items, 0, 12);
    }
}
