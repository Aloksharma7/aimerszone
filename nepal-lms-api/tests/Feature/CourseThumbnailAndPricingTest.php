<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: the course form has always sent thumbnail_url and (for staff)
 * original_price_npr, but neither controller's validator accepted them —
 * Laravel's validate() silently drops unlisted keys, so the fields looked
 * saved in the UI but never reached the database. Fixed by accepting
 * thumbnail_url and mapping it onto the existing thumbnail_path column,
 * which Course::thumbnailUrl() now returns as-is when it is already an
 * absolute URL instead of mangling it through the storage disk.
 */
class CourseThumbnailAndPricingTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_staff_can_set_a_course_thumbnail_url_and_original_price(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $course = $this->makeCourse();

        $this->actingAs($staff)
            ->patchJson('/api/v1/staff/courses/'.$course->getKey(), [
                'thumbnail_url' => 'https://cdn.example.test/course-cover.jpg',
                'original_price_npr' => 9000,
            ])
            ->assertOk();

        $response = $this->actingAs($staff)->getJson('/api/v1/staff/courses')->assertOk();
        $item = collect($response->json('data'))->firstWhere('id', $course->getKey());

        $this->assertSame('https://cdn.example.test/course-cover.jpg', $item['thumbnail_url']);
        $this->assertSame(9000, $item['original_price_npr']);

        // Stored as-is, not run through the storage disk resolver.
        $this->assertSame('https://cdn.example.test/course-cover.jpg', $course->fresh()->thumbnail_path);
    }

    public function test_admin_can_also_set_a_course_thumbnail_url(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $course = $this->makeCourse();

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/courses/'.$course->getKey(), [
                'thumbnail_url' => 'https://cdn.example.test/admin-cover.jpg',
            ])
            ->assertOk();

        $this->assertSame('https://cdn.example.test/admin-cover.jpg', $course->fresh()->thumbnail_path);
    }
}
