<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * The admin and accounting dashboards assemble a dozen-plus aggregate
 * queries per visit, so they are cached (DashboardCache) rather than run
 * fresh on every request. Two things must both be true for that to be
 * safe: the cache actually avoids re-running the queries, and a payment
 * decision — the one action whose numbers an accountant checks
 * immediately after acting — clears it right away rather than waiting out
 * the TTL.
 */
class DashboardCacheTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_repeat_dashboard_request_is_served_from_cache(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);

        $this->actingAs($superAdmin)->getJson('/api/v1/admin/dashboard')->assertOk();

        DB::enableQueryLog();
        $this->actingAs($superAdmin)->getJson('/api/v1/admin/dashboard')->assertOk();
        $queriesOnCachedRequest = count(DB::getQueryLog());
        DB::flushQueryLog();
        DB::disableQueryLog();

        // The dashboard runs well over a dozen aggregate queries when it
        // actually executes; a cache hit should cost only the cache store's
        // own read (plus session/auth bootstrap), nowhere near that.
        $this->assertLessThan(8, $queriesOnCachedRequest, 'A second identical request re-ran the dashboard queries instead of hitting the cache.');
    }

    public function test_approving_a_payment_immediately_updates_the_dashboards_instead_of_waiting_out_the_cache(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);
        $accountant = $this->makeUser(RoleKey::Staff);
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);
        $payment = $this->makePayment($student, $batch);

        $before = $this->actingAs($superAdmin)->getJson('/api/v1/admin/dashboard')->assertOk();
        $this->assertSame(1, $before->json('data.metrics.pending_payments'));

        $beforeQueue = $this->actingAs($accountant)->getJson('/api/v1/accounting/dashboard')->assertOk();
        $this->assertSame(1, $beforeQueue->json('data.metrics.pending_review'));

        $this->actingAs($accountant)
            ->postJson('/api/v1/accounting/payments/'.$payment->getKey().'/decision', ['decision' => 'approve'])
            ->assertOk();

        $after = $this->actingAs($superAdmin)->getJson('/api/v1/admin/dashboard')->assertOk();
        $this->assertSame(0, $after->json('data.metrics.pending_payments'), 'The admin dashboard served a stale cached count after the payment was approved.');

        $afterQueue = $this->actingAs($accountant)->getJson('/api/v1/accounting/dashboard')->assertOk();
        $this->assertSame(0, $afterQueue->json('data.metrics.pending_review'), 'The accounting queue served a stale cached count after the payment was approved.');
    }

    /**
     * Regression: the "attention" panel used to be cached inside the same
     * payload as everything else, but nothing ever invalidated the cache
     * when a batch left draft — only a payment decision did. That meant the
     * admin notification bell (uncached) and the dashboard's own attention
     * panel could disagree about a draft batch for up to a minute.
     */
    public function test_a_new_draft_batch_appears_on_the_dashboard_without_waiting_out_the_cache(): void
    {
        $superAdmin = $this->makeUser(RoleKey::SuperAdmin);

        // Warm the cache before the draft batch exists.
        $before = $this->actingAs($superAdmin)->getJson('/api/v1/admin/dashboard')->assertOk();
        $this->assertSame([], $before->json('data.attention'));

        $this->makeBatch($this->makeCourse(), ['status' => \App\Enums\BatchStatus::Draft->value]);

        $after = $this->actingAs($superAdmin)->getJson('/api/v1/admin/dashboard')->assertOk();
        $this->assertSame('draft-batches', $after->json('data.attention.0.id'), 'The dashboard served a stale attention panel for a signal the cache never invalidates.');
    }
}
