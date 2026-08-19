<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Models\Attendance;
use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Models\LessonCompletion;
use App\Models\Recording;
use App\Models\RecordingProgress;
use App\Models\SyllabusLesson;
use App\Models\Test;
use App\Models\TestAttempt;

/**
 * Recalculates the four progress dimensions the student dashboard shows.
 *
 * The values are denormalised onto the enrollment row because the dashboard
 * reads them for every card on every page load; recomputing four aggregates per
 * card per request would not hold up. They are refreshed when the underlying
 * event happens (attendance finalized, recording watched, attempt graded,
 * lesson completed) rather than on a timer, so they never drift silently.
 */
class EnrollmentProgressService
{
    public function recalculate(Enrollment $enrollment): Enrollment
    {
        $attendance = $this->attendancePercent($enrollment);
        $recordings = $this->recordingPercent($enrollment);
        $tests = $this->testPercent($enrollment);
        $syllabus = $this->syllabusPercent($enrollment);

        // Attendance and assessment carry more weight than passive consumption.
        $overall = (int) round(($attendance * 0.3) + ($recordings * 0.2) + ($tests * 0.3) + ($syllabus * 0.2));

        $enrollment->forceFill([
            'attendance_percent' => $attendance,
            'recording_percent' => $recordings,
            'test_percent' => $tests,
            'syllabus_percent' => $syllabus,
            'overall_percent' => min(100, $overall),
            'progress_calculated_at' => now(),
        ])->save();

        return $enrollment;
    }

    /** Only sessions whose register has been finalized count either way. */
    protected function attendancePercent(Enrollment $enrollment): int
    {
        $records = Attendance::query()
            ->where('user_id', $enrollment->user_id)
            ->whereHas('session', fn ($query) => $query
                ->where('batch_id', $enrollment->batch_id)
                ->whereNotNull('attendance_finalized_at'))
            ->get(['status']);

        if ($records->isEmpty()) {
            return 0;
        }

        $present = $records->filter(fn ($record) => in_array(
            $record->status,
            [AttendanceStatus::Present, AttendanceStatus::Late, AttendanceStatus::Excused],
            true,
        ))->count();

        return (int) round($present / $records->count() * 100);
    }

    protected function recordingPercent(Enrollment $enrollment): int
    {
        $total = Recording::query()->where('batch_id', $enrollment->batch_id)->released()->count();

        if ($total === 0) {
            return 0;
        }

        $completed = RecordingProgress::query()
            ->where('user_id', $enrollment->user_id)
            ->whereNotNull('completed_at')
            ->whereHas('recording', fn ($query) => $query->where('batch_id', $enrollment->batch_id))
            ->count();

        return (int) round(min($completed, $total) / $total * 100);
    }

    /** Share of released tests the student has actually completed an attempt for. */
    protected function testPercent(Enrollment $enrollment): int
    {
        $testIds = Test::query()
            ->where('batch_id', $enrollment->batch_id)
            ->visibleToStudents()
            ->pluck('id');

        if ($testIds->isEmpty()) {
            return 0;
        }

        $attempted = TestAttempt::query()
            ->where('user_id', $enrollment->user_id)
            ->whereIn('test_id', $testIds)
            ->whereIn('status', ['submitted', 'graded'])
            ->distinct('test_id')
            ->count('test_id');

        return (int) round($attempted / $testIds->count() * 100);
    }

    /** Public wrapper so a lesson toggle can return the new figure directly. */
    public function syllabusPercentFor(Enrollment $enrollment): int
    {
        return $this->syllabusPercent($enrollment);
    }

    protected function syllabusPercent(Enrollment $enrollment): int
    {
        $lessonIds = SyllabusLesson::query()
            ->whereHas('module', fn ($query) => $query->where('course_id', $enrollment->course_id))
            ->pluck('id');

        if ($lessonIds->isEmpty()) {
            return 0;
        }

        $completed = LessonCompletion::query()
            ->where('user_id', $enrollment->user_id)
            ->whereIn('syllabus_lesson_id', $lessonIds)
            ->whereNotNull('completed_at')
            ->count();

        return (int) round($completed / $lessonIds->count() * 100);
    }

    /**
     * The single next step shown on a course card. Ordered by urgency: a live
     * class beats an open test, which beats unwatched material.
     *
     * $liveSoon / $openTest let a caller mapping over several enrollments (a
     * student's course list) pass in a precomputed answer via
     * nextActionContextFor() instead of this running two exists() queries per
     * enrollment; a single-enrollment caller can leave them null.
     */
    public function nextAction(Enrollment $enrollment, ?bool $liveSoon = null, ?bool $openTest = null): string
    {
        $liveSoon ??= (bool) $enrollment->batch?->sessions()
            ->upcoming()
            ->where('starts_at', '<=', now()->addHours(2))
            ->exists();

        if ($liveSoon) {
            return 'Join the next live class';
        }

        $openTest ??= Test::query()
            ->where('batch_id', $enrollment->batch_id)
            ->visibleToStudents()
            ->where(fn ($query) => $query->whereNull('opens_at')->orWhere('opens_at', '<=', now()))
            ->where(fn ($query) => $query->whereNull('closes_at')->orWhere('closes_at', '>', now()))
            ->exists();

        if ($openTest) {
            return 'Attempt the open test';
        }

        if ($enrollment->recording_percent < 100) {
            return 'Continue the latest recording';
        }

        return 'Open course workspace';
    }

    /**
     * One query each for "has a live class starting soon" and "has an open
     * test" across many batches, instead of two exists() queries per
     * enrollment. Pass the results into nextAction()'s $liveSoon/$openTest.
     *
     * @return array{liveSoon: array<string, bool>, openTest: array<string, bool>} keyed by batch_id
     */
    public function nextActionContextFor(array $batchIds): array
    {
        $batchIds = $batchIds ?: ['-'];

        $liveSoon = ClassSession::query()
            ->whereIn('batch_id', $batchIds)
            ->upcoming()
            ->where('starts_at', '<=', now()->addHours(2))
            ->pluck('batch_id')
            ->unique()
            ->mapWithKeys(fn ($id) => [$id => true])
            ->all();

        $openTest = Test::query()
            ->whereIn('batch_id', $batchIds)
            ->visibleToStudents()
            ->where(fn ($query) => $query->whereNull('opens_at')->orWhere('opens_at', '<=', now()))
            ->where(fn ($query) => $query->whereNull('closes_at')->orWhere('closes_at', '>', now()))
            ->pluck('batch_id')
            ->unique()
            ->mapWithKeys(fn ($id) => [$id => true])
            ->all();

        return ['liveSoon' => $liveSoon, 'openTest' => $openTest];
    }
}
