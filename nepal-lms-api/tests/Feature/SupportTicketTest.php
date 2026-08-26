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

    /**
     * Regression: the ticket form's "related course" selector was collected
     * from the student but never had a column to land in — support_tickets
     * had no enrollment reference at all, so staff triaging a ticket never
     * knew which course it was about even though the student had told them.
     */
    public function test_a_ticket_records_which_course_it_is_about_and_staff_can_see_it(): void
    {
        $batch = $this->makeBatch($this->makeCourse(['title' => 'IELTS Foundations']));
        $student = $this->makeUser(RoleKey::Student);
        $enrollment = $this->enroll($student, $batch);
        $staff = $this->makeUser(RoleKey::Staff);

        $ticketId = $this->actingAs($student)
            ->postJson('/api/v1/student/support-tickets', [
                'subject' => 'Cannot access recording',
                'message' => 'The recording for last Tuesday will not play on my phone.',
                'enrollment_id' => $enrollment->getKey(),
            ])
            ->assertCreated()
            ->json('data.id');

        $this->assertDatabaseHas('support_tickets', ['id' => $ticketId, 'enrollment_id' => $enrollment->getKey()]);

        $this->actingAs($staff)
            ->getJson('/api/v1/support/tickets/'.$ticketId)
            ->assertOk()
            ->assertJsonPath('data.course_title', 'IELTS Foundations');
    }

    /** A ticket cannot claim to be about someone else's enrollment. */
    public function test_a_student_cannot_link_a_ticket_to_another_students_enrollment(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $owner = $this->makeUser(RoleKey::Student);
        $intruder = $this->makeUser(RoleKey::Student);
        $enrollment = $this->enroll($owner, $batch);

        $this->actingAs($intruder)
            ->postJson('/api/v1/student/support-tickets', [
                'subject' => 'Question',
                'message' => 'Is this course still running this semester?',
                'enrollment_id' => $enrollment->getKey(),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['enrollment_id']);
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
