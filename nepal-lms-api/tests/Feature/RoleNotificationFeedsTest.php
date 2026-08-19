<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\EnrollmentRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: the notification bell only ever existed for students — teacher,
 * staff and admin got a plain dashboard-link icon with no feed and no
 * expandable page at all, not a bug in an existing feature but a feature
 * that was simply never built for three of the five roles.
 */
class RoleNotificationFeedsTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_teacher_sees_pending_attendance_in_their_notification_feed(): void
    {
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch = $this->makeBatch($this->makeCourse());
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        \App\Models\ClassSession::create([
            'batch_id' => $batch->getKey(),
            'teacher_id' => $teacher->getKey(),
            'topic' => 'Finished class',
            'status' => 'completed',
            'starts_at' => now()->subHours(3),
            'ends_at' => now()->subHours(2),
        ]);

        $response = $this->actingAs($teacher)->getJson('/api/v1/teacher/notifications')->assertOk();

        $this->assertTrue(collect($response->json('data'))->contains(fn ($item) => str_contains($item['title'], 'Finalize attendance')));
    }

    public function test_a_teacher_with_nothing_outstanding_sees_an_empty_feed(): void
    {
        $teacher = $this->makeUser(RoleKey::Teacher);

        $this->actingAs($teacher)->getJson('/api/v1/teacher/notifications')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_staff_sees_pending_payments_and_enrollment_requests(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $student = $this->makeUser(RoleKey::Student);
        $batch = $this->makeBatch($this->makeCourse());
        $this->makePayment($student, $batch);

        EnrollmentRequest::create([
            'user_id' => $student->getKey(),
            'course_id' => $batch->course_id,
            'batch_id' => $batch->getKey(),
            'basis' => 'scholarship',
            'note' => 'Awaiting decision.',
            'requested_by' => $staff->getKey(),
            'status' => 'pending',
        ]);

        $response = $this->actingAs($staff)->getJson('/api/v1/staff/notifications')->assertOk();
        $titles = collect($response->json('data'))->pluck('title')->implode(' | ');

        $this->assertStringContainsString('payment', strtolower($titles));
        $this->assertStringContainsString('enrollment request', strtolower($titles));
    }

    public function test_an_admin_sees_the_same_signals_as_the_dashboard_attention_panel(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);
        $student = $this->makeUser(RoleKey::Student);
        $batch = $this->makeBatch($this->makeCourse());
        $this->makePayment($student, $batch);

        $dashboard = $this->actingAs($superAdmin)->getJson('/api/v1/admin/dashboard')->assertOk();
        $notifications = $this->actingAs($superAdmin)->getJson('/api/v1/admin/notifications')->assertOk();

        $this->assertSame(
            collect($dashboard->json('data.attention'))->pluck('id')->sort()->values()->all(),
            collect($notifications->json('data'))->pluck('id')->sort()->values()->all(),
        );
    }
}
