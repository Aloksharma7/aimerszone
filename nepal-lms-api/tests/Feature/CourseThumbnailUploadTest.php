<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Course thumbnails previously accepted only a pasted external URL — there
 * was no way to upload a file. This mirrors the payment-method QR upload
 * pattern: store on the public disk, replace the previous file, never try
 * to delete a pasted external URL from local storage.
 */
class CourseThumbnailUploadTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_staff_can_upload_and_replace_a_course_thumbnail(): void
    {
        Storage::fake('public');
        $staff = $this->makeUser(RoleKey::Staff);
        $course = $this->makeCourse();

        $first = $this->actingAs($staff)
            ->postJson("/api/v1/staff/courses/{$course->getKey()}/thumbnail", [
                'thumbnail' => UploadedFile::fake()->image('cover.jpg'),
            ])
            ->assertOk()
            ->assertJsonPath('data.thumbnail_url', fn ($url) => filled($url));

        $firstPath = $course->fresh()->thumbnail_path;
        $this->assertNotNull($firstPath);
        Storage::disk('public')->assertExists($firstPath);

        $this->actingAs($staff)
            ->postJson("/api/v1/staff/courses/{$course->getKey()}/thumbnail", [
                'thumbnail' => UploadedFile::fake()->image('cover-2.jpg'),
            ])
            ->assertOk();

        // The old file is removed once the new one is safely stored.
        Storage::disk('public')->assertMissing($firstPath);
        $this->assertNotSame($firstPath, $course->fresh()->thumbnail_path);
    }

    public function test_deleting_a_thumbnail_removes_the_stored_file(): void
    {
        Storage::fake('public');
        $admin = $this->makeUser(RoleKey::Admin);
        $course = $this->makeCourse();

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/courses/{$course->getKey()}/thumbnail", [
                'thumbnail' => UploadedFile::fake()->image('cover.jpg'),
            ])
            ->assertOk();

        $path = $course->fresh()->thumbnail_path;

        $this->actingAs($admin)
            ->deleteJson("/api/v1/admin/courses/{$course->getKey()}/thumbnail")
            ->assertOk();

        Storage::disk('public')->assertMissing($path);
        $this->assertNull($course->fresh()->thumbnail_path);
    }

    /**
     * A course whose thumbnail_url was pasted directly (an external URL, not
     * an upload) must never have Storage::delete() run against it — that
     * string was never a local path in the first place.
     */
    public function test_replacing_a_pasted_external_thumbnail_url_does_not_touch_local_storage(): void
    {
        Storage::fake('public');
        $admin = $this->makeUser(RoleKey::Admin);
        $course = $this->makeCourse(['thumbnail_path' => 'https://cdn.example.test/existing-cover.jpg']);

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/courses/{$course->getKey()}/thumbnail", [
                'thumbnail' => UploadedFile::fake()->image('cover.jpg'),
            ])
            ->assertOk();

        // Replaced with the new upload, and nothing thrown trying to delete
        // a URL that was never a local path.
        $this->assertNotSame('https://cdn.example.test/existing-cover.jpg', $course->fresh()->thumbnail_path);
        Storage::disk('public')->assertExists($course->fresh()->thumbnail_path);
    }

    public function test_a_teacher_cannot_upload_a_course_thumbnail(): void
    {
        Storage::fake('public');
        $teacher = $this->makeUser(RoleKey::Teacher);
        $course = $this->makeCourse();

        $this->actingAs($teacher)
            ->postJson("/api/v1/staff/courses/{$course->getKey()}/thumbnail", [
                'thumbnail' => UploadedFile::fake()->image('cover.jpg'),
            ])
            ->assertForbidden();
    }
}
