<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Services\MediaLinkService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: every 404 in this app — a payment with no proof ever
 * recorded, a payment whose recorded proof file is missing from disk, a
 * receipt with no PDF, a route that plain doesn't exist — rendered the
 * exact same generic "The requested record was not found.". That made a
 * data problem (nobody ever uploaded evidence) indistinguishable from an
 * infrastructure problem (the file is gone from storage), which is exactly
 * the distinction someone diagnosing a broken proof link needs.
 */
class MediaMissingFileMessagesTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_payment_with_no_proof_ever_recorded_gives_a_specific_message(): void
    {
        $staff = $this->makeUser(RoleKey::Staff);
        $batch = $this->makeBatch($this->makeCourse());
        $payment = $this->makePayment($staff, $batch, ['proof_path' => null]);

        $url = app(MediaLinkService::class)->forPaymentProof($payment)['url'];

        $response = $this->actingAs($staff)->get($url);

        $response->assertStatus(404);
        $response->assertJsonPath('code', 'no_proof_recorded');
    }

    public function test_a_payment_whose_recorded_proof_file_is_missing_from_disk_gives_a_distinct_message(): void
    {
        Storage::fake('local');
        $staff = $this->makeUser(RoleKey::Staff);
        $batch = $this->makeBatch($this->makeCourse());
        $payment = $this->makePayment($staff, $batch, [
            // Recorded in the database, but never actually written to the fake disk.
            'proof_path' => 'payment-proof/does-not-exist/proof.jpg',
            'proof_disk' => 'local',
            'proof_mime' => 'image/jpeg',
        ]);

        $url = app(MediaLinkService::class)->forPaymentProof($payment)['url'];

        $response = $this->actingAs($staff)->get($url);

        $response->assertStatus(404);
        $response->assertJsonPath('code', 'proof_file_missing');
        $this->assertStringContainsString('infrastructure problem', $response->json('message'));
    }

    public function test_the_actual_file_still_serves_correctly_when_present(): void
    {
        Storage::fake('local');
        $staff = $this->makeUser(RoleKey::Staff);
        $batch = $this->makeBatch($this->makeCourse());
        $payment = $this->makePayment($staff, $batch, [
            'proof_path' => UploadedFile::fake()->image('proof.jpg')->store('payment-proof/test', 'local'),
            'proof_disk' => 'local',
            'proof_mime' => 'image/jpeg',
        ]);

        $url = app(MediaLinkService::class)->forPaymentProof($payment)['url'];

        $this->actingAs($staff)->get($url)->assertOk();
    }
}
