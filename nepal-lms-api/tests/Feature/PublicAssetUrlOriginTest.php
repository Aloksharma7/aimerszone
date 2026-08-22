<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\PaymentMethod;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: course thumbnails, payment method QR codes, avatars and
 * institution branding all returned an absolute URL built from this API's
 * own APP_URL. next/image (and next.config.ts's own comments) expect these
 * to be same-origin with the frontend; Next's image optimizer flatly
 * refuses to load an unrecognized remote host, so every uploaded thumbnail
 * rendered as a broken image despite the upload itself succeeding.
 */
class PublicAssetUrlOriginTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
        Storage::fake('public');
    }

    public function test_an_uploaded_course_thumbnail_url_is_relative(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $course = $this->makeCourse();

        $response = $this->actingAs($staff)
            ->postJson("/api/v1/staff/courses/{$course->getKey()}/thumbnail", [
                'thumbnail' => UploadedFile::fake()->image('cover.jpg'),
            ])
            ->assertOk();

        $url = $response->json('data.thumbnail_url');
        $this->assertStringStartsWith('/storage/', $url);
        $this->assertStringNotContainsString('://', $url);
    }

    /** A pasted external CDN URL is not on this disk — it must pass through untouched. */
    public function test_a_pasted_external_thumbnail_url_is_not_rewritten(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $course = $this->makeCourse();

        $this->actingAs($staff)
            ->patchJson("/api/v1/staff/courses/{$course->getKey()}", [
                'thumbnail_url' => 'https://cdn.example.com/course.jpg',
            ])
            ->assertOk();

        $this->assertSame('https://cdn.example.com/course.jpg', $course->fresh()->thumbnailUrl());
    }

    public function test_a_payment_method_qr_url_is_relative(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);
        $method = PaymentMethod::first();

        $response = $this->actingAs($superAdmin)
            ->postJson("/api/v1/admin/payment-methods/{$method->getKey()}/qr", [
                'qr_image' => UploadedFile::fake()->image('esewa-qr.png'),
            ])
            ->assertOk();

        $this->assertStringStartsWith('/storage/', $response->json('data.qr_image_url'));
    }

    public function test_an_uploaded_institution_logo_url_is_relative_on_both_admin_and_public_endpoints(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);

        $this->actingAs($superAdmin)
            ->postJson('/api/v1/admin/settings/institution/logo', ['logo' => UploadedFile::fake()->image('logo.png')])
            ->assertOk();

        $adminUrl = $this->actingAs($superAdmin)->getJson('/api/v1/admin/settings')->json('data.institution.logo_url');
        $publicUrl = $this->getJson('/api/v1/public/settings')->json('data.logo_url');

        $this->assertStringStartsWith('/storage/', $adminUrl);
        $this->assertStringStartsWith('/storage/', $publicUrl);
    }
}
