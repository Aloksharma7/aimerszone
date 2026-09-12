<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Every account had an avatar_path column and an avatarUrl() helper already
 * wired into the profile and session responses, but no route anywhere
 * actually let someone set one — student, teacher, staff and admin all had
 * no way to upload a photo. One route under /api/v1/account covers every
 * role, mirroring the course-thumbnail upload pattern.
 */
class AccountAvatarUploadTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_student_can_upload_and_replace_their_avatar(): void
    {
        Storage::fake('public');
        $student = $this->makeUser(RoleKey::Student);

        $this->actingAs($student)
            ->postJson('/api/v1/account/avatar', ['avatar' => UploadedFile::fake()->image('me.jpg')])
            ->assertOk()
            ->assertJsonPath('data.avatar_url', fn ($url) => filled($url));

        $firstPath = $student->fresh()->avatar_path;
        Storage::disk('public')->assertExists($firstPath);

        $this->actingAs($student)
            ->postJson('/api/v1/account/avatar', ['avatar' => UploadedFile::fake()->image('me-2.jpg')])
            ->assertOk();

        Storage::disk('public')->assertMissing($firstPath);
        $this->assertNotSame($firstPath, $student->fresh()->avatar_path);
    }

    public function test_a_teacher_can_remove_their_avatar(): void
    {
        Storage::fake('public');
        $teacher = $this->makeUser(RoleKey::Teacher);

        $this->actingAs($teacher)
            ->postJson('/api/v1/account/avatar', ['avatar' => UploadedFile::fake()->image('me.jpg')])
            ->assertOk();

        $path = $teacher->fresh()->avatar_path;

        $this->actingAs($teacher)
            ->deleteJson('/api/v1/account/avatar')
            ->assertOk();

        Storage::disk('public')->assertMissing($path);
        $this->assertNull($teacher->fresh()->avatar_path);
    }

    public function test_staff_and_admin_can_also_upload_an_avatar(): void
    {
        Storage::fake('public');

        foreach ([RoleKey::Staff, RoleKey::Admin] as $role) {
            $user = $this->makeUser($role);

            $this->actingAs($user)
                ->postJson('/api/v1/account/avatar', ['avatar' => UploadedFile::fake()->image('me.jpg')])
                ->assertOk();

            $this->assertNotNull($user->fresh()->avatar_path);
        }
    }

    public function test_a_non_image_file_is_rejected(): void
    {
        Storage::fake('public');
        $student = $this->makeUser(RoleKey::Student);

        $this->actingAs($student)
            ->postJson('/api/v1/account/avatar', ['avatar' => UploadedFile::fake()->create('resume.pdf', 100, 'application/pdf')])
            ->assertStatus(422);
    }
}
