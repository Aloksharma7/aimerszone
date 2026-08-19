<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\Faq;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: FAQs were readable on the public site and the student support
 * page, but the only way one ever existed was a one-time demo seeder — no
 * admin screen or write endpoint anywhere. An institution could not add,
 * edit or remove a single question after launch without a database console.
 */
class AdminFaqTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_an_admin_can_create_edit_and_delete_a_faq(): void
    {
        // Like categories.manage, the /admin/faqs routes require the admin
        // role gate — the permission alone does not open them to staff.
        $admin = $this->makeUser(RoleKey::Admin);

        $created = $this->actingAs($admin)
            ->postJson('/api/v1/admin/faqs', [
                'question' => 'How do I reset my password?',
                'answer' => 'Use the forgot-password link on the sign-in page.',
                'category' => 'account',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->assertDatabaseHas('faqs', ['id' => $created, 'category' => 'account', 'is_published' => true]);

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/faqs/'.$created, ['is_published' => false])
            ->assertOk();

        $this->assertDatabaseHas('faqs', ['id' => $created, 'is_published' => false]);

        // Unpublished, so it must not appear on the public endpoint.
        $this->getJson('/api/v1/public/faqs')
            ->assertOk()
            ->assertJsonMissing(['id' => $created]);

        $this->actingAs($admin)
            ->deleteJson('/api/v1/admin/faqs/'.$created)
            ->assertOk();

        $this->assertDatabaseMissing('faqs', ['id' => $created]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'faq.deleted', 'target_id' => $created]);
    }

    public function test_a_teacher_cannot_manage_faqs(): void
    {
        $teacher = $this->makeUser(RoleKey::Teacher);

        $this->actingAs($teacher)
            ->postJson('/api/v1/admin/faqs', [
                'question' => 'Can a teacher do this?',
                'answer' => 'No.',
            ])
            ->assertForbidden();
    }

    public function test_the_admin_listing_includes_unpublished_entries(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $faq = Faq::create([
            'question' => 'Draft question',
            'answer' => 'Draft answer',
            'category' => 'general',
            'is_published' => false,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/faqs')
            ->assertOk()
            ->assertJsonFragment(['id' => $faq->id, 'is_published' => false]);
    }
}
