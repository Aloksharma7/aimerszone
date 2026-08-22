<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\Category;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * A cluster of gaps a staff member ran into in the same afternoon: a course
 * that would not actually publish, no way to add the category a new course
 * needed, and no way to build out a syllabus after creating the course.
 */
class StaffCatalogueGapsTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    /**
     * Regression: store() used to hardcode published => false and
     * status => Draft on every new course, silently ignoring whatever the
     * "Save and publish" button actually sent.
     */
    public function test_a_staff_member_can_publish_a_course_on_creation(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $category = Category::create(['name' => 'Test Prep', 'slug' => 'test-prep', 'is_active' => true]);

        $response = $this->actingAs($staff)
            ->postJson('/api/v1/staff/courses', [
                'title' => 'Loksewa Foundation',
                'category_id' => $category->getKey(),
                'short_description' => 'A structured foundation course for the Loksewa exam.',
                'description' => str_repeat('A clear, complete description of the course content. ', 3),
                'access_type' => 'paid',
                'price_npr' => 4000,
                'published' => true,
            ])
            ->assertCreated();

        $this->assertDatabaseHas('courses', [
            'id' => $response->json('data.id'),
            'published' => true,
            'status' => 'published',
        ]);
    }

    public function test_a_staff_member_can_create_a_category(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);

        $this->actingAs($staff)
            ->postJson('/api/v1/staff/categories', ['name' => 'Banking Preparation'])
            ->assertCreated();

        $this->assertDatabaseHas('categories', ['name' => 'Banking Preparation']);
    }

    public function test_a_staff_member_can_write_a_course_syllabus(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $course = $this->makeCourse();

        $this->actingAs($staff)
            ->putJson("/api/v1/staff/courses/{$course->getKey()}/syllabus", [
                'modules' => [
                    ['title' => 'Module 1', 'lessons' => [['title' => 'Introduction', 'type' => 'Lesson']]],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.modules.0.title', 'Module 1');
    }

    /**
     * Regression: reports.financial did not exist, so this used to be gated
     * by the same reports.view permission staff needs for other exports —
     * removing it entirely would have broken those too.
     */
    public function test_a_staff_member_cannot_reach_the_financial_collections_report(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);

        $this->actingAs($staff)
            ->getJson('/api/v1/accounting/reports/collections')
            ->assertForbidden();

        // Their own operational exports must still work.
        $this->actingAs($staff)
            ->getJson('/api/v1/staff/students/export')
            ->assertOk();
    }

    public function test_an_admin_can_reach_the_financial_collections_report(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);

        $this->actingAs($admin)
            ->getJson('/api/v1/accounting/reports/collections')
            ->assertOk();
    }
}
