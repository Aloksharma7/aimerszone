<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\DeviceToken;
use App\Services\NotificationDispatcher;
use App\Services\SettingsRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Push is a channel independent of SMS — see NotificationDispatcher::wantsPush().
 * Expo's endpoint is real network I/O, so every test here fakes it.
 */
class PushNotificationTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_token_authenticated_request_can_register_and_replace_a_device_token(): void
    {
        $student = $this->makeUser(RoleKey::Student);
        $token = $student->createToken('device')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/account/device-tokens', ['expo_push_token' => 'ExponentPushToken[abc]', 'platform' => 'android'])
            ->assertCreated();

        $this->assertDatabaseHas('device_tokens', ['user_id' => $student->getKey(), 'expo_push_token' => 'ExponentPushToken[abc]']);

        // The same token re-registering under a different account is
        // reassigned, not duplicated. Sanctum's guard caches the resolved
        // user across simulated requests within one test method (unlike two
        // real, separate production requests) — see MobileLoginTest.
        Auth::forgetGuards();
        $other = $this->makeUser(RoleKey::Student);
        $otherToken = $other->createToken('device')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$otherToken}")
            ->postJson('/api/v1/account/device-tokens', ['expo_push_token' => 'ExponentPushToken[abc]'])
            ->assertCreated();

        $this->assertSame(1, DeviceToken::where('expo_push_token', 'ExponentPushToken[abc]')->count());
        $this->assertDatabaseHas('device_tokens', ['user_id' => $other->getKey(), 'expo_push_token' => 'ExponentPushToken[abc]']);
    }

    public function test_a_token_authenticated_request_can_remove_its_own_device_token(): void
    {
        $student = $this->makeUser(RoleKey::Student);
        $token = $student->createToken('device')->plainTextToken;

        DeviceToken::create(['user_id' => $student->getKey(), 'expo_push_token' => 'ExponentPushToken[xyz]']);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->deleteJson('/api/v1/account/device-tokens', ['expo_push_token' => 'ExponentPushToken[xyz]'])
            ->assertOk();

        $this->assertDatabaseMissing('device_tokens', ['expo_push_token' => 'ExponentPushToken[xyz]']);
    }

    public function test_payment_approval_sends_a_push_to_a_registered_device(): void
    {
        Http::fake(['exp.host/*' => Http::response(['data' => ['status' => 'ok']])]);

        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $payment = $this->makePayment($student, $batch);
        DeviceToken::create(['user_id' => $student->getKey(), 'expo_push_token' => 'ExponentPushToken[device1]']);

        app(NotificationDispatcher::class)->paymentApproved($payment);

        Http::assertSent(fn ($request) => $request->url() === 'https://exp.host/--/api/v2/push/send'
            && $request['to'] === 'ExponentPushToken[device1]'
            && $request['data']['type'] === 'payment.approved');
    }

    public function test_push_is_skipped_entirely_when_the_feature_is_disabled(): void
    {
        Http::fake();
        app(SettingsRepository::class)->set('features', 'push_notifications', false);

        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $payment = $this->makePayment($student, $batch);
        DeviceToken::create(['user_id' => $student->getKey(), 'expo_push_token' => 'ExponentPushToken[device2]']);

        app(NotificationDispatcher::class)->paymentApproved($payment);

        Http::assertNothingSent();
    }

    public function test_a_device_not_registered_response_deletes_the_stale_token(): void
    {
        Http::fake([
            'exp.host/*' => Http::response(['data' => ['status' => 'error', 'message' => 'not registered', 'details' => ['error' => 'DeviceNotRegistered']]]),
        ]);

        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $payment = $this->makePayment($student, $batch);
        DeviceToken::create(['user_id' => $student->getKey(), 'expo_push_token' => 'ExponentPushToken[stale]']);

        app(NotificationDispatcher::class)->paymentApproved($payment);

        $this->assertDatabaseMissing('device_tokens', ['expo_push_token' => 'ExponentPushToken[stale]']);
    }
}
