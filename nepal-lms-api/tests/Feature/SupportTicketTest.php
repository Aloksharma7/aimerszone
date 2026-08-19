<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: SupportTicket::create() never set `status`, and the very next
 * line read $ticket->status->value on the un-refetched in-memory model —
 * every single ticket submission crashed with a 500, from both the student
 * support page and the public contact form.
 */
class SupportTicketTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_student_can_submit_a_support_ticket(): void
    {
        $student = $this->makeUser(RoleKey::Student);

        $this->actingAs($student)
            ->postJson('/api/v1/student/support-tickets', [
                'subject' => 'Cannot access recording',
                'message' => 'The recording for last Tuesday will not play on my phone.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'open');
    }

    public function test_a_guest_can_submit_the_public_contact_form(): void
    {
        $this->postJson('/api/v1/public/support-requests', [
            'name' => 'Prospective Student',
            'email' => 'prospective@example.test',
            'subject' => 'Course timing',
            'message' => 'What time does the evening batch start?',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'open');
    }
}
