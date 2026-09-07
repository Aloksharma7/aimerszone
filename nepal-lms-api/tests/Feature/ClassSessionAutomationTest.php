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
