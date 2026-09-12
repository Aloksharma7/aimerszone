<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\TeacherProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * The public /teachers page's photo is deliberately separate from a
 * teacher's own account avatar, so an administrator can curate what the
 * public site shows. TeacherProfile already had an avatar_path column and
 * TeacherResource already read it — but as an absolute URL built from this
 * API's own APP_URL (the same wrong-origin bug already fixed for payment
 * proof, course thumbnails and institution branding), and with no route to
 * ever set it in the first place.
 */
class AdminTeacherPhotoUploadTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_an_admin_can_upload_a_teachers_public_photo_creating_the_profile_if_needed(): void
    {
        Storage::fake('public');
        $admin = $this->makeUser(RoleKey::Admin);
        $teacher = $this->makeUser(RoleKey::Teacher);

        $this->assertNull($teacher->teacherProfile);

        $response = $this->actingAs($admin)
            ->postJson("/api/v1/admin/teachers/{$teacher->id}/photo", ['photo' => UploadedFile::fake()->image('teacher.jpg')])
            ->assertOk();

        $url = $response->json('data.avatar_url');
        $this->assertNotEmpty($url);
        $this->assertStringStartsNotWith('http', $url, 'The URL must be relative, like every other signed/public asset link in this app.');

        $profile = $teacher->fresh()->teacherProfile;
        $this->assertNotNull($profile);
        Storage::disk('public')->assertExists($profile->avatar_path);
    }

    public function test_uploading_again_replaces_the_previous_photo(): void
    {
        Storage::fake('public');
        $admin = $this->makeUser(RoleKey::Admin);
        $teacher = $this->makeUser(RoleKey::Teacher);
        $profile = TeacherProfile::create(['user_id' => $teacher->getKey(), 'slug' => 'existing-teacher']);

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/teachers/{$teacher->id}/photo", ['photo' => UploadedFile::fake()->image('first.jpg')])
            ->assertOk();
        $firstPath = $profile->fresh()->avatar_path;

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/teachers/{$teacher->id}/photo", ['photo' => UploadedFile::fake()->image('second.jpg')])
            ->assertOk();

        Storage::disk('public')->assertMissing($firstPath);
        $this->assertNotSame($firstPath, $profile->fresh()->avatar_path);
    }

    public function test_deleting_the_photo_removes_the_file_and_falls_back_to_the_account_avatar(): void
    {
        Storage::fake('public');
        $admin = $this->makeUser(RoleKey::Admin);
        $teacher = $this->makeUser(RoleKey::Teacher, ['avatar_path' => 'avatars/fallback.jpg']);

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/teachers/{$teacher->id}/photo", ['photo' => UploadedFile::fake()->image('teacher.jpg')])
            ->assertOk();
        $path = $teacher->fresh()->teacherProfile->avatar_path;

        $this->actingAs($admin)
            ->deleteJson("/api/v1/admin/teachers/{$teacher->id}/photo")
            ->assertOk();

        Storage::disk('public')->assertMissing($path);
        $this->assertNull($teacher->fresh()->teacherProfile->avatar_path);

        $listed = $this->actingAs($admin)->getJson('/api/v1/admin/teachers')->assertOk();
        $row = collect($listed->json('data'))->firstWhere('user_id', $teacher->id);
        $this->assertStringContainsString('avatars/fallback.jpg', $row['avatar_url']);
    }

    public function test_a_non_teacher_account_is_refused(): void
    {
        Storage::fake('public');
        $admin = $this->makeUser(RoleKey::Admin);
        $student = $this->makeUser(RoleKey::Student);

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/teachers/{$student->id}/photo", ['photo' => UploadedFile::fake()->image('teacher.jpg')])
            ->assertStatus(422);
    }

    public function test_a_teacher_cannot_upload_another_teachers_public_photo(): void
    {
        Storage::fake('public');
        $teacher = $this->makeUser(RoleKey::Teacher);
        $otherTeacher = $this->makeUser(RoleKey::Teacher);

        $this->actingAs($teacher)
            ->postJson("/api/v1/admin/teachers/{$otherTeacher->id}/photo", ['photo' => UploadedFile::fake()->image('teacher.jpg')])
            ->assertForbidden();
    }
}
