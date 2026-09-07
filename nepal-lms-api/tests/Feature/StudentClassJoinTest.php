<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\ClassSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: the join window opening was being treated as sufficient on its
 * own. A class still "Scheduled" — the teacher never pressed Start — handed
 * out a real Zoom link the moment the clock reached the scheduled window,
 * with nothing checking that a teacher had actually started the class.
 */
class StudentClassJoinTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_student_cannot_join_a_scheduled_class_even_inside_the_time_window(): void
    {
        $student = $this->makeUser(RoleKey::Student);
        $batch = $this->makeBatch($this->makeCourse());
        $this->enroll($student, $batch);

        $session = ClassSession::create([
            'batch_id' => $batch->getKey(),
            'topic' => 'Not started yet',
            'status' => 'scheduled',
            'starts_at' => now()->addMinutes(5),
            'ends_at' => now()->addMinutes(50),
            'zoom_join_url' => 'https://zoom.example.test/j/123',
        ]);

        $this->actingAs($student)
            ->postJson('/api/v1/student/classes/'.$session->getKey().'/join')
            ->assertStatus(409)
            ->assertJsonPath('code', 'class_not_started');
    }

    public function test_a_student_can_join_once_the_teacher_has_started_the_class(): void
    {
        $student = $this->makeUser(RoleKey::Student);
        $batch = $this->makeBatch($this->makeCourse());
        $this->enroll($student, $batch);

        $session = ClassSession::create([
            'batch_id' => $batch->getKey(),
            'topic' => 'Live now',
            'status' => 'live',
            'starts_at' => now()->subMinutes(5),
            'ends_at' => now()->addMinutes(40),
            'zoom_join_url' => 'https://zoom.example.test/j/123',
        ]);

        $this->actingAs($student)
            ->postJson('/api/v1/student/classes/'.$session->getKey().'/join')
            ->assertOk();
    }

    public function test_the_student_class_list_marks_a_scheduled_class_as_not_yet_joinable(): void
    {
        $student = $this->makeUser(RoleKey::Student);
        $batch = $this->makeBatch($this->makeCourse());
        $enrollment = $this->enroll($student, $batch);

        ClassSession::create([
            'batch_id' => $batch->getKey(),
            'topic' => 'Not started yet',
            'status' => 'scheduled',
            'starts_at' => now()->addMinutes(5),
            'ends_at' => now()->addMinutes(50),
            'zoom_join_url' => 'https://zoom.example.test/j/123',
        ]);

        $response = $this->actingAs($student)
            ->getJson('/api/v1/student/courses/'.$enrollment->getKey().'/classes')
            ->assertOk();

        $this->assertFalse($response->json('data.0.join_available'));
        $this->assertSame('Waiting for the teacher to start', $response->json('data.0.action_reason'));
    }
}
