<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Facebook, Instagram and YouTube links for the public footer. These are
 * brand-new setting keys with no prior stored row on any existing database,
 * so SettingsRepository::all()'s array_merge(defaults, stored) already
 * serves config/lms.php's values with no seeder run required — unlike a
 * permission grant, a setting key with nothing stored for it falls straight
 * through to its config default.
 */
class InstitutionSocialLinksTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_the_configured_defaults_reach_the_public_settings_endpoint_unseeded(): void
    {
        $response = $this->getJson('/api/v1/public/settings')->assertOk();

        $response->assertJsonPath('data.social.facebook', fn ($url) => is_string($url) && str_contains($url, 'facebook.com'));
        $response->assertJsonPath('data.social.instagram', fn ($url) => is_string($url) && str_contains($url, 'instagram.com'));
        $response->assertJsonPath('data.social.youtube', fn ($url) => is_string($url) && str_contains($url, 'youtube.com'));
    }

    public function test_an_admin_can_update_the_social_links_and_the_public_endpoint_reflects_it(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);

        $this->actingAs($superAdmin)
            ->patchJson('/api/v1/admin/settings', [
                'institution' => [
                    'name' => 'Aimers Zone',
                    'facebook_url' => 'https://www.facebook.com/newpage',
                    'instagram_url' => 'https://www.instagram.com/newprofile',
                    'youtube_url' => 'https://www.youtube.com/@newchannel',
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.institution.facebook_url', 'https://www.facebook.com/newpage')
            ->assertJsonPath('data.institution.instagram_url', 'https://www.instagram.com/newprofile')
            ->assertJsonPath('data.institution.youtube_url', 'https://www.youtube.com/@newchannel');

        $this->getJson('/api/v1/public/settings')
            ->assertOk()
            ->assertJsonPath('data.social.facebook', 'https://www.facebook.com/newpage')
            ->assertJsonPath('data.social.instagram', 'https://www.instagram.com/newprofile')
            ->assertJsonPath('data.social.youtube', 'https://www.youtube.com/@newchannel');
    }

    public function test_a_social_link_must_be_a_real_url(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);

        $this->actingAs($superAdmin)
            ->patchJson('/api/v1/admin/settings', [
                'institution' => ['name' => 'Aimers Zone', 'facebook_url' => 'not-a-url'],
            ])
            ->assertStatus(422);
    }
}
