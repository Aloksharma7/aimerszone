<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: /media/* routes use the 'auth' (session) guard, and this API
 * has no named 'login' route. Before this fix, ApiExceptionRenderer only
 * rendered clean JSON for requests that expect JSON or hit /api/*, so an
 * unauthenticated or expired-session request for a signed recording/receipt
 * link fell through to Laravel's raw HTML/debug error page.
 */
class SignedMediaLinkTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_an_unauthenticated_request_for_a_signed_recording_link_gets_a_clean_json_error(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $recording = $this->makeRecording($batch);

        $url = URL::temporarySignedRoute('media.recording', now()->addMinutes(5), ['recording' => $recording->getKey()]);

        $response = $this->get($url);

        $response->assertStatus(401);
        $response->assertJsonPath('code', 'unauthenticated');
    }
}
