<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\SupportTicket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: staff got zero notification of any kind — SMS, push, or in
 * the bell — when a student replied to or opened a support ticket, the
 * mirror image of the (already fixed) gap where students weren't notified
 * of a staff reply. "Open" status specifically means the ball is in
 * staff's court (set on creation, and put back by a student's own reply),
 * so it's the exact right signal for the staff notification feed.
 */
class StaffTicketNotificationTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_an_open_ticket_appears_in_the_staff_notification_feed(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $student = $this->makeUser(RoleKey::Student);

        SupportTicket::create([
            'reference' => 'TKT-0001',
            'user_id' => $student->getKey(),
            'name' => $student->name,
            'email' => $student->email,
            'subject' => 'Cannot access my course',
            'message' => 'I paid last week but still cannot see the batch.',
            'status' => 'open',
        ]);

        $response = $this->actingAs($staff)->getJson('/api/v1/staff/notifications')->assertOk();

        $this->assertTrue(collect($response->json('data'))->contains(
            fn ($item) => str_contains($item['title'], 'awaiting a reply'),
        ));
    }

    public function test_a_student_reply_reopens_the_ticket_and_it_surfaces_to_staff(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $student = $this->makeUser(RoleKey::Student);

        // Pending = waiting on the student, per TicketController::reply()'s
        // own status transitions — the realistic prior state for a reply
        // that puts it back in staff's court.
        $ticket = SupportTicket::create([
            'reference' => 'TKT-0002',
            'user_id' => $student->getKey(),
            'name' => $student->name,
            'email' => $student->email,
            'subject' => 'Cannot access my course',
            'message' => 'I paid last week but still cannot see the batch.',
            'status' => 'pending',
        ]);

        $this->actingAs($student)
            ->postJson('/api/v1/support/tickets/'.$ticket->getKey().'/messages', [
                'body' => 'This is still not fixed, I still cannot see the batch.',
            ])
            ->assertOk();

        $this->assertSame('open', $ticket->fresh()->status->value);

        $response = $this->actingAs($staff)->getJson('/api/v1/staff/notifications')->assertOk();
        $this->assertTrue(collect($response->json('data'))->contains(
            fn ($item) => str_contains($item['title'], 'awaiting a reply'),
        ));
    }

    public function test_a_resolved_ticket_with_no_open_reply_does_not_appear(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $student = $this->makeUser(RoleKey::Student);

        SupportTicket::create([
            'reference' => 'TKT-0003',
            'user_id' => $student->getKey(),
            'name' => $student->name,
            'email' => $student->email,
            'subject' => 'Already resolved',
            'message' => 'Thanks, this is sorted.',
            'status' => 'resolved',
            'resolved_at' => now(),
        ]);

        $response = $this->actingAs($staff)->getJson('/api/v1/staff/notifications')->assertOk();

        $this->assertFalse(collect($response->json('data'))->contains(
            fn ($item) => str_contains($item['title'], 'awaiting a reply'),
        ));
    }
}
