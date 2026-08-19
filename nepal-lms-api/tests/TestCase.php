<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use CreatesApplication;

    /**
     * Sanctum's EnsureFrontendRequestsAreStateful only starts a session (and
     * activates cookie/CSRF/AuthenticateSession middleware) for requests that
     * look like they came from a stateful-domain frontend (Origin/Referer
     * header) — real browsers always send one. Call this from a test that
     * exercises the real login/logout endpoints, where session()->regenerate()
     * requires a started session.
     *
     * Not applied globally: AuthenticateSession's password-hash check does
     * not tolerate the "actingAs($a), then actingAs($b)" pattern used
     * throughout this suite to prove one user can't reach another's data —
     * both calls share the same test session cookie, and a real login always
     * starts from a fresh, unauthenticated one.
     */
    protected function actingAsFrontend(): static
    {
        return $this->withHeader('Origin', config('app.frontend_url'));
    }
}
