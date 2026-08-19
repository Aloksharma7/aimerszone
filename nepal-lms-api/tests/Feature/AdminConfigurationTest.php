<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\PaymentMethod;
use App\Services\SettingsRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * The promise that everything is administrator-controlled: a settings change
 * must actually take effect on the next request, without a deployment.
 */
class AdminConfigurationTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_changing_the_institution_name_reaches_the_public_endpoint(): void
    {
        $admin = $this->makeUser(RoleKey::SuperAdmin);

        $this->actingAs($admin)->patchJson('/api/v1/admin/settings', [
            'institution' => [
                'name' => 'Janakpur Study Centre',
                'support_email' => 'help@janakpur.test',
            ],
        ])->assertOk();

        $this->getJson('/api/v1/public/settings')
            ->assertOk()
            ->assertJsonPath('data.institution_name', 'Janakpur Study Centre')
            ->assertJsonPath('data.support.email', 'help@janakpur.test');

        $this->assertDatabaseHas('audit_logs', ['action' => 'settings.updated']);
    }

    public function test_maintenance_mode_pauses_writes_but_leaves_reads_open(): void
    {
        $settings = app(SettingsRepository::class);
        $settings->set('operations', 'maintenance_notice', true);

        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);

        // Students keep their information; only state changes are paused.
        $this->actingAs($student)->getJson('/api/v1/student/dashboard')->assertOk();

        $this->actingAs($student)
            ->postJson('/api/v1/student/support-tickets', [
                'subject' => 'Question about my batch',
                'message' => 'I would like to ask about the class schedule.',
            ])
            ->assertStatus(503)
            ->assertJsonPath('code', 'maintenance_mode');
    }

    public function test_an_administrator_still_works_during_maintenance(): void
    {
        app(SettingsRepository::class)->set('operations', 'maintenance_notice', true);

        $admin = $this->makeUser(RoleKey::SuperAdmin);

        $this->actingAs($admin)
            ->patchJson('/api/v1/admin/settings', ['operations' => ['maintenance_notice' => false]])
            ->assertOk();

        $this->assertFalse(app(SettingsRepository::class)->bool('operations.maintenance_notice'));
    }

    /**
     * Regression: this guard used to key off 'admin', a leftover from before
     * the role split — it let super_admin's permission set be edited (a
     * cosmetic no-op given Gate::before, but misleading) while blocking the
     * now-ordinary admin role from being edited at all.
     */
    public function test_the_super_admin_role_cannot_be_edited_into_a_weaker_one(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);
        $role = \App\Models\Role::where('key', 'super_admin')->firstOrFail();

        $this->actingAs($superAdmin)
            ->patchJson('/api/v1/admin/roles/'.$role->getKey(), ['permissions' => ['courses.view']])
            ->assertStatus(409)
            ->assertJsonPath('code', 'role_protected');
    }

    public function test_the_plain_admin_role_can_have_its_permissions_edited(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);
        $role = \App\Models\Role::where('key', 'admin')->firstOrFail();

        $this->actingAs($superAdmin)
            ->patchJson('/api/v1/admin/roles/'.$role->getKey(), ['permissions' => ['courses.view']])
            ->assertOk();

        $this->assertSame(['courses.view'], $role->fresh()->permissions->pluck('key')->all());
    }

    public function test_a_super_admin_can_upload_and_remove_a_payment_method_qr_image(): void
    {
        Storage::fake('public');
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);
        $method = PaymentMethod::first();

        $this->actingAs($superAdmin)
            ->postJson("/api/v1/admin/payment-methods/{$method->getKey()}/qr", [
                'qr_image' => UploadedFile::fake()->image('esewa-qr.png'),
            ])
            ->assertOk()
            ->assertJsonPath('data.qr_image_url', fn ($url) => filled($url));

        $this->assertNotNull($method->fresh()->qr_image_path);

        $this->actingAs($superAdmin)
            ->deleteJson("/api/v1/admin/payment-methods/{$method->getKey()}/qr")
            ->assertOk();

        $this->assertNull($method->fresh()->qr_image_path);
    }

    public function test_a_plain_admin_cannot_upload_a_payment_method_qr_image(): void
    {
        Storage::fake('public');
        $admin = $this->makeUser(RoleKey::Admin);
        $method = PaymentMethod::first();

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/payment-methods/{$method->getKey()}/qr", [
                'qr_image' => UploadedFile::fake()->image('esewa-qr.png'),
            ])
            ->assertForbidden();
    }

    public function test_an_idempotency_key_replays_instead_of_repeating_the_action(): void
    {
        $admin = $this->makeUser(RoleKey::SuperAdmin);
        $key = 'test-key-'.uniqid();

        $payload = ['institution' => ['name' => 'Replay Institute']];

        $first = $this->actingAs($admin)
            ->withHeaders(['Idempotency-Key' => $key])
            ->patchJson('/api/v1/admin/settings', $payload)
            ->assertOk();

        $second = $this->actingAs($admin)
            ->withHeaders(['Idempotency-Key' => $key])
            ->patchJson('/api/v1/admin/settings', $payload)
            ->assertOk();

        $this->assertSame('true', $second->headers->get('Idempotent-Replay'));

        // The same key with a different body is a mistake, not a retry.
        $this->actingAs($admin)
            ->withHeaders(['Idempotency-Key' => $key])
            ->patchJson('/api/v1/admin/settings', ['institution' => ['name' => 'Different Name']])
            ->assertStatus(409)
            ->assertJsonPath('code', 'idempotency_key_reuse');
    }
}
