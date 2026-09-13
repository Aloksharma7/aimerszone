<?php

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\RoleKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: the admin courses list always showed a batch count of 0, no
 * matter how many open or ongoing batches a course actually had.
 * Batch::status is cast to the BatchStatus enum, so $batch->status is an
 * enum instance — CourseSummaryResource::available_batches compared it
 * against the raw strings 'open'/'ongoing' with Collection::whereIn(), which
 * uses loose (==) comparison. A PHP enum instance is never loosely equal to
 * its own backing string, so the filter matched nothing, silently, for
 * every course.
 */
class AdminCourseBatchCountTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_the_course_list_counts_open_and_ongoing_batches_correctly(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $course = $this->makeCourse();
        $this->makeBatch($course, ['status' => BatchStatus::Open->value]);
        $this->makeBatch($course, ['status' => BatchStatus::Ongoing->value]);
        $this->makeBatch($course, ['status' => BatchStatus::Closed->value]);

        $response = $this->actingAs($admin)->getJson('/api/v1/admin/courses?per_page=100')->assertOk();

        $row = collect($response->json('data'))->firstWhere('id', $course->getKey());
        $this->assertSame(2, $row['available_batches']);
    }

    public function test_the_course_detail_page_counts_open_and_ongoing_batches_correctly(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $course = $this->makeCourse();
        $this->makeBatch($course, ['status' => BatchStatus::Open->value]);
        $this->makeBatch($course, ['status' => BatchStatus::Ongoing->value]);

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/courses/'.$course->getKey())
            ->assertOk()
            ->assertJsonPath('data.available_batches', 2);
    }
}
