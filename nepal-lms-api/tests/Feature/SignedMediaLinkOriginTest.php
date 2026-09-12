<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Services\MediaLinkService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
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

    /**
     * Regression: the link is minted inside a same-origin /api/... POST and
     * opened moments later by a same-origin /media/... GET — two separate
     * requests that each travel through Next's rewrite and then this API's
     * own nginx site. Nothing guarantees those two hops agree on exactly
     * what host/scheme they report upstream on any given request, and an
     * absolute signature (the Laravel default) bakes whatever host was
     * resolved at *generation* time into the hash — so the moment the second
     * hop resolves a different one, a perfectly legitimate, unexpired link
     * fails validation with "Invalid signature.". Relative signing (see
     * routes/media.php and MediaLinkService::sign()) never looks at host or
     * scheme at all, so this failure mode cannot happen. Simulated here by
     * forcing a different root URL at generation time than the one the test
     * client actually requests against.
     */
    public function test_a_payment_proof_link_still_verifies_when_the_generating_and_opening_requests_disagree_on_host(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $accountant = $this->makeUser(RoleKey::Staff);
        $payment = $this->makePayment($student, $batch, [
            'proof_path' => UploadedFile::fake()->image('proof.jpg')->store('payment-proof/test', 'local'),
            'proof_disk' => 'local',
            'proof_mime' => 'image/jpeg',
        ]);

        URL::forceRootUrl('https://api.aimerszone.edu.np');
        $url = app(MediaLinkService::class)->forPaymentProof($payment)['url'];
        URL::forceRootUrl(null);

        // The test client's default host (http://localhost) stands in for
        // whatever this second, independent hop happens to resolve — the
        // point is only that it differs from the host used above.
        $this->actingAs($accountant)
            ->get($url)
            ->assertOk()
            ->assertHeader('Content-Type', 'image/jpeg');
    }
}
