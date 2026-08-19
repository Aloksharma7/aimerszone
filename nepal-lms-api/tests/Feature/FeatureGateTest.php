<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Services\FeatureGate;
use App\Services\SettingsRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * The admin-controlled switches, and the rule that a switch alone is not
 * enough — a feature without credentials must report itself unusable.
 */
class FeatureGateTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_sms_is_not_ready_until_credentials_are_pasted(): void
    {
        $settings = app(SettingsRepository::class);
        $gate = app(FeatureGate::class);

        $settings->set('features', 'sms_notifications', true);
        $settings->flush();

        $this->assertFalse($gate->sms(), 'A switch without a token must not report ready.');

        $settings->set('sms', 'token', 'test-token', encrypt: true);
        $settings->set('sms', 'sender_id', 'Demo');
        $settings->flush();

        $this->assertTrue(app(FeatureGate::class)->sms());
    }

    public function test_esewa_is_not_ready_without_a_secret(): void
    {
        $settings = app(SettingsRepository::class);

        $settings->set('features', 'esewa_checkout', true);
        $settings->flush();

        $this->assertFalse(app(FeatureGate::class)->esewa());
    }

    public function test_the_admin_panel_reports_what_each_feature_is_waiting_for(): void
    {
        $admin = $this->makeUser(RoleKey::SuperAdmin);

        app(SettingsRepository::class)->set('features', 'sms_notifications', true);
        app(SettingsRepository::class)->flush();

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/settings')
            ->assertOk()
            ->assertJsonPath('data.features.sms_notifications.enabled', true)
            ->assertJsonPath('data.features.sms_notifications.ready', false)
            ->assertJsonPath('data.sms.token_configured', false);
    }

    /** A secret must never come back out of the API once stored. */
    public function test_secrets_are_never_returned_by_a_read(): void
    {
        $admin = $this->makeUser(RoleKey::SuperAdmin);

        $this->actingAs($admin)->patchJson('/api/v1/admin/settings', [
            'sms' => ['token' => 'super-secret-token', 'sender_id' => 'Demo'],
        ])->assertOk();

        $response = $this->actingAs($admin)->getJson('/api/v1/admin/settings')->assertOk();

        $this->assertStringNotContainsString('super-secret-token', $response->getContent());
        $this->assertTrue($response->json('data.sms.token_configured'));
    }

    /** Saving the form without retyping a secret must not wipe it. */
    public function test_a_blank_secret_leaves_the_stored_value_alone(): void
    {
        $admin = $this->makeUser(RoleKey::SuperAdmin);

        $this->actingAs($admin)->patchJson('/api/v1/admin/settings', [
            'sms' => ['token' => 'first-token', 'sender_id' => 'Demo'],
        ])->assertOk();

        $this->actingAs($admin)->patchJson('/api/v1/admin/settings', [
            'sms' => ['token' => '', 'sender_id' => 'Changed'],
        ])->assertOk();

        $this->assertSame('first-token', app(SettingsRepository::class)->get('sms.token'));
        $this->assertSame('Changed', app(SettingsRepository::class)->string('sms.sender_id'));
    }

    public function test_support_tickets_can_be_switched_off(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);

        app(SettingsRepository::class)->set('features', 'student_support_tickets', false);
        app(SettingsRepository::class)->flush();

        $this->actingAs($student)
            ->postJson('/api/v1/student/support-tickets', [
                'subject' => 'A question about class timing',
                'message' => 'Could you confirm the evening batch schedule please.',
            ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'support_tickets_disabled');
    }
}
