<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Enums\TestStatus;
use App\Models\TestAttempt;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: the teacher's own test list and builder view read the stored
 * status column directly. That column only ever holds 'draft' or 'open' —
 * everything past publishing (scheduled, closed, result released) is
 * computed from opens_at/closes_at/result_release, the same way
 * StudentTestResource::displayStatus() already computes it for a student's
 * own view. So a test the teacher scheduled to open next week showed as
 * "Open" the moment it was published, and a test that closed weeks ago kept
 * reading as "Open" forever, since nothing ever moves the stored column past
 * that point. Test::effectiveStatus() now backs both teacher-facing reads,
 * matching what students were already correctly shown.
 */
class TestEffectiveStatusTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_published_test_opening_in_the_future_reads_as_scheduled(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $test = $this->makeTest($batch, [
            'status' => TestStatus::Open->value,
            'opens_at' => now()->addWeek(),
            'closes_at' => now()->addWeek()->addHours(2),
        ]);

        $list = $this->actingAs($teacher)->getJson('/api/v1/teacher/tests')->assertOk();
        $row = collect($list->json('data'))->firstWhere('id', $test->getKey());
        $this->assertSame('scheduled', $row['status']);

        $this->actingAs($teacher)
            ->getJson('/api/v1/teacher/tests/'.$test->getKey().'/builder')
            ->assertOk()
            ->assertJsonPath('data.status', 'scheduled');
    }

    public function test_a_test_past_its_closing_time_with_no_released_results_reads_as_closed(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $test = $this->makeTest($batch, [
            'status' => TestStatus::Open->value,
            'opens_at' => now()->subWeeks(2),
            'closes_at' => now()->subWeek(),
            'result_release' => 'manual',
        ]);

        $list = $this->actingAs($teacher)->getJson('/api/v1/teacher/tests')->assertOk();
        $row = collect($list->json('data'))->firstWhere('id', $test->getKey());
        $this->assertSame('closed', $row['status']);
    }

    public function test_a_test_with_released_results_reads_as_result_released(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);
        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);

        $test = $this->makeTest($batch, [
            'status' => TestStatus::Open->value,
            'opens_at' => now()->subWeeks(2),
            'closes_at' => now()->subWeek(),
            'result_release' => 'manual',
            'results_released_at' => now()->subDay(),
        ]);

        TestAttempt::create([
            'test_id' => $test->getKey(),
            'user_id' => $student->getKey(),
            'status' => 'graded',
            'started_at' => now()->subWeeks(2),
            'submitted_at' => now()->subWeeks(2),
            'graded_at' => now()->subWeeks(2),
            'expires_at' => now()->subWeeks(2)->addHour(),
            'score' => 2,
            'max_score' => 2,
        ]);

        $list = $this->actingAs($teacher)->getJson('/api/v1/teacher/tests')->assertOk();
        $row = collect($list->json('data'))->firstWhere('id', $test->getKey());
        $this->assertSame('result_released', $row['status']);
    }

    public function test_a_currently_open_test_still_reads_as_open(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $test = $this->makeTest($batch, [
            'status' => TestStatus::Open->value,
            'opens_at' => now()->subHour(),
            'closes_at' => now()->addHours(2),
        ]);

        $list = $this->actingAs($teacher)->getJson('/api/v1/teacher/tests')->assertOk();
        $row = collect($list->json('data'))->firstWhere('id', $test->getKey());
        $this->assertSame('open', $row['status']);
    }

    public function test_a_draft_still_reads_as_draft(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $test = $this->makeTest($batch, [
            'status' => TestStatus::Draft->value,
            'opens_at' => now()->addWeek(),
        ]);

        $list = $this->actingAs($teacher)->getJson('/api/v1/teacher/tests')->assertOk();
        $row = collect($list->json('data'))->firstWhere('id', $test->getKey());
        $this->assertSame('draft', $row['status']);
    }
}
