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
 * Regression: MediaLinkService returned an absolute URL built from this
 * API's own APP_URL — a different origin from wherever the frontend is
 * actually served. The frontend's trustedDestination() check only opens
 * same-origin (or explicitly allow-listed HTTPS) links, so it silently
 * refused every one of these: payment proof, resource downloads, receipts,
 * self-hosted recording playback all failed to open with no visible error.
 */
class SignedMediaLinkOriginTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
        Storage::fake('local');
    }

    public function test_a_payment_proof_link_is_relative_not_bound_to_this_apis_own_origin(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $payment = $this->makePayment($student, $batch, [
            'proof_path' => UploadedFile::fake()->image('proof.jpg')->store('payment-proof/test', 'local'),
            'proof_disk' => 'local',
            'proof_mime' => 'image/jpeg',
        ]);

        $url = app(MediaLinkService::class)->forPaymentProof($payment)['url'];

        $this->assertStringStartsWith('/media/', $url, 'The link must be relative so it resolves against the frontend\'s own origin.');
        $this->assertStringNotContainsString('://', $url, 'An absolute URL is exactly what trustedDestination() on the frontend rejects.');
    }

    /**
     * Proves the relative form is not just cosmetically different — the
     * signature must still verify when the path is actually requested,
     * which is what next.config.ts's /media/:path* proxy actually sends.
     */
    public function test_the_relative_payment_proof_link_still_serves_the_file_when_requested(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);
        $payment = $this->makePayment($student, $batch, [
            'proof_path' => UploadedFile::fake()->image('proof.jpg')->store('payment-proof/test', 'local'),
            'proof_disk' => 'local',
            'proof_mime' => 'image/jpeg',
        ]);

        $url = app(MediaLinkService::class)->forPaymentProof($payment)['url'];

        $this->actingAs($accountant)
            ->get($url)
            ->assertOk()
            ->assertHeader('Content-Type', 'image/jpeg');
    }
}
