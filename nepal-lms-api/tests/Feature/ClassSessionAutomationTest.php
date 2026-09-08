<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\Announcement;
use App\Models\ClassSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: nothing ever moved a class out of "Live" except a teacher
 * manually finalizing attendance, which can happen hours later or never — so
 * the student portal kept showing a pulsing "Live now" badge for a class that
 * had already ended. Separately, scheduling a class left enrolled students to
 * discover it only by reloading a page that happened to list classes, with no
 * notification of any kind.
 */
class ClassSessionAutomationTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_stale_live_class_is_expired_once_its_join_window_has_closed(): void
    {
        $batch = $this->makeBatch($this->makeCourse());

        $stale = ClassSession::create([
            'batch_id' => $batch->getKey(),
            'topic' => 'Long over',
            'status' => 'live',
            'starts_at' => now()->subHours(3),
            'ends_at' => now()->subHours(2),
        ]);

        $recent = ClassSession::create([
            'batch_id' => $batch->getKey(),
            'topic' => 'Still within the join window',
            'status' => 'live',
            'starts_at' => now()->subMinutes(30),
            'ends_at' => now()->subMinutes(5),
        ]);

        $this->artisan('lms:expire-live-classes')->assertSuccessful();

        $this->assertSame('completed', $stale->fresh()->status->value);
        $this->assertNotNull($stale->fresh()->actual_ended_at);
        $this->assertSame('live', $recent->fresh()->status->value);
    }

    /**
     * Regression: the fix above only helps once lms:expire-live-classes has
     * actually run — every 15 minutes at best, or never if the server's cron
     * was never configured to call schedule:run at all. A student reading
     * the API in that gap saw "Live now" for a class that plainly ended,
     * because the resource serialized the stored status column directly.
     * effectiveStatus() computes it from starts_at/ends_at instead, so this
     * is correct on every read, independent of whether the cron ever runs.
     */
    public function test_an_overdue_live_class_reads_as_completed_before_the_cron_ever_runs(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $enrollment = $this->enroll($student, $batch);

        $overdue = ClassSession::create([
            'batch_id' => $batch->getKey(),
            'topic' => 'Long over, never expired',
            'status' => 'live',
            'starts_at' => now()->subHours(3),
            'ends_at' => now()->subHours(2),
        ]);

        $neverStarted = ClassSession::create([
            'batch_id' => $batch->getKey(),
            'topic' => 'Scheduled, teacher never started it',
            'status' => 'scheduled',
            'starts_at' => now()->subHours(3),
            'ends_at' => now()->subHours(2),
        ]);

        $stillLive = ClassSession::create([
            'batch_id' => $batch->getKey(),
            'topic' => 'Genuinely in progress',
            'status' => 'live',
            'starts_at' => now()->subMinutes(10),
            'ends_at' => now()->addMinutes(20),
        ]);

        // Confirmed still 'live'/'scheduled' at rest — nothing ran the cron.
        $this->assertSame('live', $overdue->fresh()->status->value);
        $this->assertSame('scheduled', $neverStarted->fresh()->status->value);

        $response = $this->actingAs($student)
            ->getJson('/api/v1/student/courses/'.$enrollment->getKey().'/classes')
            ->assertOk();

        $byId = collect($response->json('data'))->keyBy('id');
        $this->assertSame('completed', $byId[$overdue->getKey()]['status']);
        $this->assertSame('completed', $byId[$neverStarted->getKey()]['status']);
        $this->assertSame('live', $byId[$stillLive->getKey()]['status']);
    }

    public function test_scheduling_a_class_announces_it_to_enrolled_students(): void
    {
        $teacher = $this->makeUser(RoleKey::Teacher);
        $student = $this->makeUser(RoleKey::Student);
        $batch = $this->makeBatch($this->makeCourse());
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);
        $this->enroll($student, $batch);

        $this->actingAs($teacher)->postJson('/api/v1/teacher/classes', [
            'batch_id' => $batch->getKey(),
            'title' => 'Momentum and Collisions',
            'starts_at' => now()->addDay()->toIso8601String(),
            'ends_at' => now()->addDay()->addHour()->toIso8601String(),
        ])->assertCreated();

        $this->assertTrue(Announcement::query()->where('batch_id', $batch->getKey())->exists());

        $response = $this->actingAs($student)->getJson('/api/v1/student/notifications')->assertOk();

        $this->assertTrue(collect($response->json('data'))->contains(
            fn ($item) => str_contains($item['title'], 'Momentum and Collisions'),
        ));
    }

    public function test_a_recurring_schedule_creates_one_announcement_not_one_per_class(): void
    {
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch = $this->makeBatch($this->makeCourse());
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $this->actingAs($teacher)->postJson('/api/v1/teacher/classes/recurring', [
            'batch_id' => $batch->getKey(),
            'title' => 'Daily Revision',
            'start_date' => now()->addDay()->toDateString(),
            'end_date' => now()->addDays(5)->toDateString(),
            'start_time' => '18:00',
            'duration_minutes' => 60,
            'frequency' => 'daily',
        ])->assertCreated();

        $this->assertSame(1, Announcement::query()->where('batch_id', $batch->getKey())->count());
    }
}
