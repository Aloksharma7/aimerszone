<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\RecordingProgress;
use App\Models\SyllabusLesson;
use App\Models\SyllabusModule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: progress_percent is only ever a furthest-seeked position, so a
 * student scrubbing straight to the end of a recording and letting it play
 * for a moment reported the same 100% — and triggered the same lesson
 * completion and enrollment-progress bump — as someone who actually watched
 * the whole thing. Documented as a known, deliberate scope cut in the commit
 * that first wired up real progress reporting (5ca7fdc). watched_seconds now
 * accumulates real elapsed time between check-ins (capped just past the
 * player's ~15s check-in interval, so a stale gap is never credited), and a
 * recording with a known duration must show at least half of that duration
 * corroborated before a 95%+ position counts as complete.
 */
class RecordingWatchTimeCorroborationTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    private function makeLinkedRecording(int $durationSeconds): array
    {
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $module = SyllabusModule::create(['course_id' => $course->getKey(), 'title' => 'Elasticity', 'order' => 0]);
        $lesson = SyllabusLesson::create(['syllabus_module_id' => $module->getKey(), 'title' => 'Meaning and scope', 'type' => 'Recording', 'order' => 0]);

        $recording = $this->makeRecording($batch, [
            'syllabus_lesson_id' => $lesson->getKey(),
            'released_at' => now()->subMinute(),
            'state' => 'available',
            'duration_seconds' => $durationSeconds,
        ]);

        $student = $this->makeUser(RoleKey::Student);
        $enrollment = $this->enroll($student, $batch);

        return [$recording, $student, $enrollment, $lesson];
    }

    public function test_seeking_straight_to_the_end_does_not_complete_a_timed_recording(): void
    {
        [$recording, $student, $enrollment, $lesson] = $this->makeLinkedRecording(3600);

        $this->actingAs($student)
            ->postJson('/api/v1/student/recordings/'.$recording->getKey().'/playback', ['progress_percent' => 100])
            ->assertOk();

        $this->assertDatabaseMissing('lesson_completions', [
            'user_id' => $student->getKey(),
            'syllabus_lesson_id' => $lesson->getKey(),
        ]);
        $this->assertSame(0, $enrollment->fresh()->syllabus_percent);

        $progress = RecordingProgress::where('recording_id', $recording->getKey())->where('user_id', $student->getKey())->firstOrFail();
        $this->assertNull($progress->completed_at);
        $this->assertSame(100, $progress->progress_percent);
    }

    public function test_enough_corroborated_watch_time_completes_a_timed_recording(): void
    {
        [$recording, $student, $enrollment, $lesson] = $this->makeLinkedRecording(3600);

        // Simulates prior check-ins already having accumulated half the
        // recording's length; capped-at-20-per-tick accumulation is unit
        // logic exercised directly here rather than via dozens of real
        // 15-second-apart requests.
        RecordingProgress::create([
            'recording_id' => $recording->getKey(),
            'user_id' => $student->getKey(),
            'progress_percent' => 80,
            'last_position_seconds' => 2880,
            'watched_seconds' => 1780,
            'last_watched_at' => now()->subSeconds(30),
        ]);

        $this->actingAs($student)
            ->postJson('/api/v1/student/recordings/'.$recording->getKey().'/playback', ['progress_percent' => 100])
            ->assertOk();

        $this->assertDatabaseHas('lesson_completions', [
            'user_id' => $student->getKey(),
            'syllabus_lesson_id' => $lesson->getKey(),
        ]);
        $this->assertSame(100, $enrollment->fresh()->syllabus_percent);

        $progress = RecordingProgress::where('recording_id', $recording->getKey())->where('user_id', $student->getKey())->firstOrFail();
        $this->assertNotNull($progress->completed_at);
        $this->assertGreaterThanOrEqual(1800, $progress->watched_seconds);
    }

    public function test_a_stale_gap_between_checkins_is_not_credited_as_watch_time(): void
    {
        [$recording, $student] = $this->makeLinkedRecording(3600);

        RecordingProgress::create([
            'recording_id' => $recording->getKey(),
            'user_id' => $student->getKey(),
            'progress_percent' => 50,
            'watched_seconds' => 500,
            // A student who left the tab open overnight, then resumed —
            // the whole gap must not be credited as watch time.
            'last_watched_at' => now()->subHours(10),
        ]);

        $this->actingAs($student)
            ->patchJson('/api/v1/student/recordings/'.$recording->getKey().'/progress', [
                'progress_percent' => 55,
                'position_seconds' => 1980,
            ])
            ->assertOk();

        $progress = RecordingProgress::where('recording_id', $recording->getKey())->where('user_id', $student->getKey())->firstOrFail();
        $this->assertLessThanOrEqual(520, $progress->watched_seconds);
    }

    public function test_a_recording_with_no_known_duration_still_completes_on_the_reported_position(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $recording = $this->makeRecording($batch, ['released_at' => now()->subMinute(), 'state' => 'available']);
        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);

        $this->actingAs($student)
            ->postJson('/api/v1/student/recordings/'.$recording->getKey().'/playback', ['progress_percent' => 100])
            ->assertOk();

        $progress = RecordingProgress::where('recording_id', $recording->getKey())->where('user_id', $student->getKey())->firstOrFail();
        $this->assertSame(100, $progress->progress_percent);
        $this->assertNotNull($progress->completed_at);
    }
}
