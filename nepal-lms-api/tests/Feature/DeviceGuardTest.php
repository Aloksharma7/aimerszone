<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Services\SettingsRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Single-device login: the control that stops one purchased seat serving a
 * study group.
 */
class DeviceGuardTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
        $this->actingAsFrontend();

        $settings = app(SettingsRepository::class);
        $settings->set('features', 'single_device_login', true);
        $settings->flush();

        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
    }

    public function test_a_second_device_is_refused_for_a_student(): void
    {
        $student = $this->makeUser(RoleKey::Student);

        $this->withHeaders(['X-Device-Id' => 'device-one-abcdef'])
            ->postJson('/api/v1/auth/login', ['identifier' => $student->mobile, 'password' => 'password123'])
            ->assertOk();

        $this->postJson('/api/v1/auth/logout')->assertOk();

        // Signing out frees the slot, so the same device returns fine.
        $this->withHeaders(['X-Device-Id' => 'device-one-abcdef'])
            ->postJson('/api/v1/auth/login', ['identifier' => $student->mobile, 'password' => 'password123'])
            ->assertOk();
    }

    public function test_a_teacher_is_not_restricted(): void
    {
        $teacher = $this->makeUser(RoleKey::Teacher);

        $this->withHeaders(['X-Device-Id' => 'teacher-device-one'])
            ->postJson('/api/v1/auth/login', ['identifier' => $teacher->email, 'password' => 'password123'])
            ->assertOk();

        $this->assertSame(0, \App\Models\DeviceSession::where('user_id', $teacher->getKey())->count());
    }

    public function test_staff_can_reset_a_students_devices(): void
    {
        $admin = $this->makeUser(RoleKey::Admin);
        $student = $this->makeUser(RoleKey::Student);

        \App\Models\DeviceSession::create([
            'user_id' => $student->getKey(),
            'device_hash' => hash('sha256', 'lost-phone'),
            'label' => 'Chrome on Android',
            'last_active_at' => now(),
        ]);

        $this->actingAs($admin)
            ->postJson('/api/v1/admin/users/'.$student->getKey().'/devices/reset', [
                'reason' => 'Student replaced their phone and cannot sign in.',
            ])
            ->assertOk()
            ->assertJsonPath('data.released', 1);

        $this->assertDatabaseHas('audit_logs', ['action' => 'user.devices_reset']);
    }
}
