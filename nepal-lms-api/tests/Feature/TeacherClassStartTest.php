<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\ClassSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: a provider outage (or simply no Zoom integration configured,
 * as on a free Zoom plan) must not block a class any more for the teacher's
 * own start path than it already does for the student's join path. Before
 * this fix, start() ignored a published fallback link entirely and always
 * rejected with "No host link is available" when zoom_start_url was blank,
 * even though that fallback link is exactly what students were about to
 * receive instead.
 */
class TeacherClassStartTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    private function makeSession(array $attributes = []): ClassSession
    {
        $batch = $this->makeBatch($this->makeCourse());
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $session = ClassSession::create(array_merge([
            'batch_id' => $batch->getKey(),
            'teacher_id' => $teacher->getKey(),
            'topic' => 'Elasticity of Demand',
            'status' => 'scheduled',
            'starts_at' => now()->addMinutes(10),
            'ends_at' => now()->addMinutes(70),
            'provider' => 'zoom',
        ], $attributes));

        return $session->setRelation('batch', $batch)->fresh()->load('batch');
    }

    public function test_a_teacher_can_start_a_class_through_its_published_fallback_link(): void
    {
        $session = $this->makeSession([
            'fallback_active' => true,
            'fallback_join_url' => 'https://meet.example.com/personal-room',
            'fallback_note' => 'Zoom is not connected on the free plan.',
        ]);

        $this->actingAs($session->teacher)
            ->postJson('/api/v1/teacher/classes/'.$session->getKey().'/start')
            ->assertOk()
            ->assertJsonPath('data.redirect_url', 'https://meet.example.com/personal-room');

        $this->assertSame('live', $session->fresh()->status->value);
    }

    public function test_starting_a_class_with_no_host_link_and_no_fallback_is_still_rejected(): void
    {
        $session = $this->makeSession();

        $this->actingAs($session->teacher)
            ->postJson('/api/v1/teacher/classes/'.$session->getKey().'/start')
            ->assertStatus(409)
            ->assertJsonPath('code', 'host_link_unavailable');
    }
}
