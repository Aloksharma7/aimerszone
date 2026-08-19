<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * Caches the expensive dashboard aggregate payloads (a dozen-plus count
 * queries assembled into one response) so a landing-page visit does not
 * re-run every one of them on every request.
 *
 * The cache store here is the `database` driver, which does not support
 * Laravel's cache tags — so this uses plain keys with an explicit forget()
 * on the write paths that would otherwise leave a visibly stale number (a
 * payment decision, since "pending payments" and "collections this month"
 * are the numbers an admin is most likely to check right after acting on
 * one). Everything else that could change these numbers (a new batch, a
 * new enrollment, and so on) is still covered by the short TTL below —
 * within a minute it self-heals even if nothing explicitly cleared it.
 */
class DashboardCache
{
    public const ADMIN = 'dashboard.admin';

    public const ACCOUNTING = 'dashboard.accounting';

    protected const TTL_SECONDS = 60;

    /** @param  callable(): array  $callback */
    public function remember(string $key, callable $callback): array
    {
        return Cache::remember($key, self::TTL_SECONDS, $callback);
    }

    public function forget(string $key): void
    {
        Cache::forget($key);
    }

    /** Every dashboard a payment decision could change the figures on. */
    public function forgetPaymentRelated(): void
    {
        Cache::forget(self::ADMIN);
        Cache::forget(self::ACCOUNTING);
    }
}
