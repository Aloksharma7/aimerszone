<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Services\SettingsRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * The institution's logo, favicon and tagline used to have no admin control
 * at all — logo_url and tagline existed as settings keys nothing ever wrote
 * to, and favicon did not exist as a concept anywhere in the platform.
 */
class InstitutionBrandingTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
        Storage::fake('public');
    }

    public function test_a_super_admin_can_upload_replace_and_remove_the_institution_logo(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);

        $first = $this->actingAs($superAdmin)
            ->postJson('/api/v1/admin/settings/institution/logo', ['logo' => UploadedFile::fake()->image('logo.png')])
            ->assertOk()
            ->json('data.logo_url');

        $this->assertNotNull($first);

        $this->getJson('/api/v1/public/settings')->assertOk()->assertJsonPath('data.logo_url', $first);

        $firstPath = app(SettingsRepository::class)->get('institution.logo_path');
        Storage::disk('public')->assertExists($firstPath);

        // Replacing must not leave the old file behind.
        $this->actingAs($superAdmin)
            ->postJson('/api/v1/admin/settings/institution/logo', ['logo' => UploadedFile::fake()->image('logo-2.png')])
            ->assertOk();
        Storage::disk('public')->assertMissing($firstPath);

        $this->actingAs($superAdmin)->deleteJson('/api/v1/admin/settings/institution/logo')->assertOk();

        $this->getJson('/api/v1/public/settings')->assertOk()->assertJsonPath('data.logo_url', null);
    }

    public function test_a_favicon_accepts_ico_and_stays_under_its_own_smaller_size_cap(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);

        $this->actingAs($superAdmin)
            ->postJson('/api/v1/admin/settings/institution/favicon', [
                'favicon' => UploadedFile::fake()->create('favicon.ico', 100),
            ])
            ->assertOk()
            ->assertJsonPath('data.favicon_url', fn ($url) => filled($url));

        $this->getJson('/api/v1/public/settings')->assertOk()->assertJsonPath('data.favicon_url', fn ($url) => filled($url));

        $oversized = UploadedFile::fake()->create('favicon.ico', 600);

        $this->actingAs($superAdmin)
            ->postJson('/api/v1/admin/settings/institution/favicon', ['favicon' => $oversized])
            ->assertStatus(422);
    }

    public function test_the_tagline_can_be_changed_and_reaches_the_public_endpoint(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);

        $this->actingAs($superAdmin)
            ->patchJson('/api/v1/admin/settings', ['institution' => ['name' => 'Janakpur Study Centre', 'tagline' => 'Evening batches every weekday.']])
            ->assertOk()
            ->assertJsonPath('data.institution.tagline', 'Evening batches every weekday.');

        $this->getJson('/api/v1/public/settings')
            ->assertOk()
            ->assertJsonPath('data.tagline', 'Evening batches every weekday.');
    }

    public function test_a_plain_admin_cannot_change_institution_branding(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/settings/institution/logo', ['logo' => UploadedFile::fake()->image('logo.png')])
            ->assertForbidden();
    }
}
