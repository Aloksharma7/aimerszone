<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\Announcement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: the admin "Create announcement" form sent audience_type/
 * audience_id/scheduled_at and a channel value ("in_app"/"in_app_email")
 * the backend never recognized (it validates audience/course_id|batch_id|
 * role_key/publish_at and channel as portal|email|sms|whatsapp) — every
 * submission 422'd, so no admin announcement had ever actually been
 * created. Separately, the "status" field the frontend already sent was
 * never validated or applied at all, so even a corrected request would
 * have published or scheduled immediately regardless of "Save draft".
 * And role-targeted announcements, once actually created, reached nobody
 * outside the student portal — nothing else read the Announcement model.
 */
class AdminAnnouncementDeliveryTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_an_admin_can_publish_an_announcement_to_everyone(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/announcements', [
                'title' => 'Platform maintenance this weekend',
                'body' => 'The portal will be briefly unavailable on Saturday night for scheduled maintenance.',
                'audience' => 'all',
                'channel' => 'portal',
                'status' => 'published',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'published');

        $announcement = Announcement::firstOrFail();
        $this->assertSame('all', $announcement->audience->value);
        $this->assertNotNull($announcement->published_at);
    }

    public function test_saving_a_draft_does_not_publish_it(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/announcements', [
                'title' => 'Draft: new refund policy',
                'body' => 'Still finalizing the wording with legal before this goes out.',
                'audience' => 'all',
                'status' => 'draft',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft');

        $announcement = Announcement::firstOrFail();
        $this->assertNull($announcement->published_at);

        // A draft must not reach anyone yet.
        $student = $this->makeUser(RoleKey::Student);
        $response = $this->actingAs($student)->getJson('/api/v1/student/notifications')->assertOk();
        $this->assertFalse(collect($response->json('data'))->contains('id', $announcement->getKey()));
    }

    public function test_a_role_targeted_announcement_reaches_teachers_and_staff_but_not_students(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/announcements', [
                'title' => 'New grading rubric for this term',
                'body' => 'All teachers should review the updated rubric before finalizing any test results.',
                'audience' => 'role',
                'role_key' => 'teacher',
                'status' => 'published',
            ])
            ->assertCreated();

        $teacher = $this->makeUser(RoleKey::Teacher);
        $teacherFeed = $this->actingAs($teacher)->getJson('/api/v1/teacher/notifications')->assertOk();
        $this->assertTrue(collect($teacherFeed->json('data'))->contains(
            fn ($item) => str_contains($item['title'], 'New grading rubric'),
        ));

        $staff = $this->makeUser(RoleKey::Staff);
        $staffFeed = $this->actingAs($staff)->getJson('/api/v1/staff/notifications')->assertOk();
        $this->assertFalse(collect($staffFeed->json('data'))->contains(
            fn ($item) => str_contains($item['title'], 'New grading rubric'),
        ));

        $student = $this->makeUser(RoleKey::Student);
        $studentFeed = $this->actingAs($student)->getJson('/api/v1/student/notifications')->assertOk();
        $this->assertFalse(collect($studentFeed->json('data'))->contains(
            fn ($item) => str_contains($item['title'], 'New grading rubric'),
        ));
    }

    public function test_an_all_audience_announcement_reaches_teachers_and_staff_too(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/announcements', [
                'title' => 'Office closed on public holiday',
                'body' => 'The institution office will be closed next Monday for the public holiday.',
                'audience' => 'all',
                'status' => 'published',
            ])
            ->assertCreated();

        $teacher = $this->makeUser(RoleKey::Teacher);
        $teacherFeed = $this->actingAs($teacher)->getJson('/api/v1/teacher/notifications')->assertOk();
        $this->assertTrue(collect($teacherFeed->json('data'))->contains(
            fn ($item) => str_contains($item['title'], 'Office closed'),
        ));

        $staff = $this->makeUser(RoleKey::Staff);
        $staffFeed = $this->actingAs($staff)->getJson('/api/v1/staff/notifications')->assertOk();
        $this->assertTrue(collect($staffFeed->json('data'))->contains(
            fn ($item) => str_contains($item['title'], 'Office closed'),
        ));
    }

    /**
     * Regression: the course-scoped announcements list never passed its
     * actual read state through to AnnouncementResource, so every
     * announcement read as unread here even after being read from the main
     * notification feed — the two lists disagreed about the same fact.
     */
    public function test_the_course_scoped_announcement_list_reflects_real_read_state(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $student = $this->makeUser(RoleKey::Student);
        $batch = $this->makeBatch($this->makeCourse());
        $enrollment = $this->enroll($student, $batch);

        $created = $this->actingAs($admin)
            ->postJson('/api/v1/admin/announcements', [
                'title' => 'Batch schedule change',
                'body' => 'This batch now meets an hour earlier starting next week.',
                'audience' => 'batch',
                'batch_id' => $batch->getKey(),
                'status' => 'published',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($student)
            ->postJson('/api/v1/student/announcements/'.$created.'/read')
            ->assertOk();

        $response = $this->actingAs($student)
            ->getJson('/api/v1/student/courses/'.$enrollment->getKey().'/announcements')
            ->assertOk();

        $this->assertTrue(collect($response->json('data'))->firstWhere('id', $created)['read']);
    }

    public function test_an_admin_can_delete_an_announcement(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $announcement = Announcement::create([
            'title' => 'Old notice',
            'body' => 'No longer relevant.',
            'audience' => 'all',
            'channel' => 'portal',
            'status' => 'published',
            'published_at' => now(),
            'created_by' => $admin->getKey(),
        ]);

        $this->actingAs($admin)
            ->deleteJson('/api/v1/admin/announcements/'.$announcement->getKey())
            ->assertOk();

        $this->assertDatabaseMissing('announcements', ['id' => $announcement->getKey()]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'announcement.deleted', 'target_id' => $announcement->getKey()]);
    }

    public function test_a_teacher_cannot_delete_an_announcement(): void
    {
        $teacher = $this->makeUser(RoleKey::Teacher);
        $announcement = Announcement::create([
            'title' => 'Old notice',
            'body' => 'No longer relevant.',
            'audience' => 'all',
            'channel' => 'portal',
            'status' => 'published',
            'published_at' => now(),
        ]);

        $this->actingAs($teacher)
            ->deleteJson('/api/v1/admin/announcements/'.$announcement->getKey())
            ->assertForbidden();
    }
}
