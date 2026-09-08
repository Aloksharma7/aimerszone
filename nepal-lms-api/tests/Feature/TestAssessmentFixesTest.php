<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\TestAttempt;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Four separate, previously-confirmed bugs in the test/assessment lifecycle:
 *
 * 1. allow_late_submission gives an attempt its own deadline past the test's
 *    global closes_at, but the policy gating the start/resume endpoint only
 *    ever checked the global window — so reloading mid-test right as the
 *    test closed locked a student out of their own still-valid attempt.
 * 2. "Manual release" was a selectable option with no code path anywhere
 *    that could ever fire it, permanently withholding scores.
 * 3. An attempt auto-graded by running out of time (autosave path or the
 *    once-a-minute cron) never recalculated the student's dashboard
 *    progress, unlike the explicit "click Submit" path.
 * 4. Editing pass_mark after attempts exist silently orphaned every already-
 *    graded attempt's frozen passed flag against the new number.
 */
class TestAssessmentFixesTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_student_can_resume_a_still_valid_attempt_after_the_test_globally_closes(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);

        $test = $this->makeTest($batch, [
            'closes_at' => now()->subMinutes(5),
            'allow_late_submission' => true,
            'duration_minutes' => 60,
        ]);

        $attempt = TestAttempt::create([
            'test_id' => $test->getKey(),
            'user_id' => $student->getKey(),
            'attempt_number' => 1,
            'status' => 'in_progress',
            'started_at' => now()->subMinutes(10),
            'expires_at' => now()->addMinutes(50),
            'question_order' => $test->questions()->pluck('id')->all(),
        ]);

        $response = $this->actingAs($student)
            ->postJson('/api/v1/student/tests/'.$test->getKey().'/attempts')
            ->assertCreated();

        $this->assertSame($attempt->id, $response->json('data.id'));
    }

    public function test_a_student_cannot_start_a_fresh_attempt_once_truly_closed(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);

        $test = $this->makeTest($batch, [
            'closes_at' => now()->subMinutes(5),
            'allow_late_submission' => true,
        ]);

        // No existing attempt at all — allow_late_submission must not reopen
        // the test to a student who never started one.
        $this->actingAs($student)
            ->postJson('/api/v1/student/tests/'.$test->getKey().'/attempts')
            ->assertForbidden();
    }

    public function test_manual_release_actually_releases_results(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);
        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);

        $test = $this->makeTest($batch, ['result_release' => 'manual']);

        $attempt = TestAttempt::create([
            'test_id' => $test->getKey(),
            'user_id' => $student->getKey(),
            'attempt_number' => 1,
            'status' => 'graded',
            'started_at' => now()->subMinutes(20),
            'expires_at' => now()->subMinutes(10),
            'submitted_at' => now()->subMinutes(10),
            'graded_at' => now()->subMinutes(10),
            'score' => 2,
            'max_score' => 2,
            'passed' => true,
            'question_order' => $test->questions()->pluck('id')->all(),
        ]);

        $this->actingAs($student)
            ->getJson('/api/v1/student/attempts/'.$attempt->getKey().'/result')
            ->assertOk()
            ->assertJsonPath('data.score', null);

        $this->actingAs($teacher)
            ->postJson('/api/v1/teacher/tests/'.$test->getKey().'/release-results')
            ->assertOk();

        $this->assertNotNull($test->fresh()->results_released_at);

        $this->actingAs($student)
            ->getJson('/api/v1/student/attempts/'.$attempt->getKey().'/result')
            ->assertOk()
            ->assertJsonPath('data.score', 2);
    }

    public function test_releasing_twice_is_refused(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);
        $test = $this->makeTest($batch, ['result_release' => 'manual', 'results_released_at' => now()]);

        $this->actingAs($teacher)
            ->postJson('/api/v1/teacher/tests/'.$test->getKey().'/release-results')
            ->assertStatus(409)
            ->assertJsonPath('code', 'already_released');
    }

    public function test_an_attempt_auto_graded_by_autosave_after_expiry_still_updates_progress(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $enrollment = $this->enroll($student, $batch);
        $test = $this->makeTest($batch);

        $this->assertNull($enrollment->fresh()->progress_calculated_at);

        $attempt = TestAttempt::create([
            'test_id' => $test->getKey(),
            'user_id' => $student->getKey(),
            'enrollment_id' => $enrollment->getKey(),
            'attempt_number' => 1,
            'status' => 'in_progress',
            'started_at' => now()->subMinutes(40),
            'expires_at' => now()->subMinutes(10),
            'question_order' => $test->questions()->pluck('id')->all(),
        ]);

        $questionId = $test->questions()->value('id');

        $this->actingAs($student)
            ->patchJson('/api/v1/student/attempts/'.$attempt->getKey().'/responses', [
                'answers' => [['question_id' => $questionId, 'response' => 'anything']],
            ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'attempt_expired');

        $this->assertSame('graded', $attempt->fresh()->status->value);
        $this->assertNotNull($enrollment->fresh()->progress_calculated_at);
    }

    public function test_an_attempt_auto_graded_by_the_cron_still_updates_progress(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $enrollment = $this->enroll($student, $batch);
        $test = $this->makeTest($batch);

        TestAttempt::create([
            'test_id' => $test->getKey(),
            'user_id' => $student->getKey(),
            'enrollment_id' => $enrollment->getKey(),
            'attempt_number' => 1,
            'status' => 'in_progress',
            'started_at' => now()->subMinutes(40),
            'expires_at' => now()->subMinutes(10),
            'question_order' => $test->questions()->pluck('id')->all(),
        ]);

        $this->artisan('lms:finalize-attempts')->assertSuccessful();

        $this->assertNotNull($enrollment->fresh()->progress_calculated_at);
    }

    public function test_pass_mark_cannot_change_once_attempts_exist_but_the_schedule_still_can(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);
        $student = $this->makeUser(RoleKey::Student);
        $test = $this->makeTest($batch, ['pass_mark' => 1]);

        TestAttempt::create([
            'test_id' => $test->getKey(),
            'user_id' => $student->getKey(),
            'attempt_number' => 1,
            'status' => 'graded',
            'started_at' => now()->subHour(),
            'expires_at' => now()->subMinutes(30),
            'score' => 1,
            'max_score' => 2,
            'passed' => true,
            'question_order' => $test->questions()->pluck('id')->all(),
        ]);

        $newClose = now()->addDay();

        // Changing the pass mark is refused...
        $this->actingAs($teacher)
            ->patchJson('/api/v1/teacher/tests/'.$test->getKey(), [
                'title' => $test->title,
                'closes_at' => $newClose->toIso8601String(),
                'pass_mark' => 2,
            ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'test_has_attempts');

        // ...but the same request re-sending the *unchanged* pass mark, to
        // move only the schedule, still goes through.
        $this->actingAs($teacher)
            ->patchJson('/api/v1/teacher/tests/'.$test->getKey(), [
                'title' => $test->title,
                'closes_at' => $newClose->toIso8601String(),
                'pass_mark' => 1,
            ])
            ->assertOk();

        $this->assertSame(1, (int) $test->fresh()->pass_mark);
        $this->assertTrue($test->fresh()->closes_at->equalTo($newClose) || $test->fresh()->closes_at->diffInSeconds($newClose) < 2);
    }
}
