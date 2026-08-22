<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\BatchStatus;
use App\Enums\IntegrationProvider;
use App\Enums\RoleKey;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Batch;
use App\Models\Category;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\IntegrationEvent;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\User;
use App\Services\AdminAttentionService;
use App\Services\DashboardCache;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * The administrator landing page.
 *
 * Everything here is a count or a derived signal, so the whole payload is
 * assembled from aggregate queries rather than loading records into memory —
 * upwards of a dozen queries, cached for a short window (see DashboardCache)
 * rather than run fresh on every visit.
 */
class DashboardController extends Controller
{
    public function __construct(
        protected SettingsRepository $settings,
        protected DashboardCache $cache,
        protected AdminAttentionService $attentionService,
    ) {}

    public function __invoke(): JsonResponse
    {
        $cached = $this->cache->remember(DashboardCache::ADMIN, fn () => [
            'metrics' => $this->metrics(),
            'services' => $this->services(),
            'audit' => $this->audit(),
            'readiness' => $this->readiness(),
        ]);

        // Kept out of the cached payload on purpose: the notification bell
        // shows these same signals uncached, and attendance/Zoom/draft-batch
        // changes have no cache-invalidation hook of their own (unlike a
        // payment decision — see DashboardCache::forgetPaymentRelated). A
        // cached copy here could disagree with the bell for up to a minute;
        // recomputing it is a handful of cheap count queries either way.
        return ApiResponse::item($cached + ['attention' => $this->attentionService->items()]);
    }

    protected function metrics(): array
    {
        return [
            'active_students' => User::query()
                ->where('status', UserStatus::Active->value)
                ->withRole(RoleKey::Student)
                ->count(),

            'active_batches' => Batch::query()
                ->whereIn('status', [BatchStatus::Open->value, BatchStatus::Ongoing->value])
                ->count(),

            'published_courses' => Course::query()->publiclyVisible()->count(),

            'categories' => Category::query()->where('is_active', true)->count(),

            'active_enrollments' => Enrollment::query()->accessible()->count(),

            'pending_payments' => Payment::query()->pendingReview()->count(),

            // Approved money for the current calendar month.
            'collections_month_npr' => (int) Payment::query()
                ->approved()
                ->where('reviewed_at', '>=', now()->startOfMonth())
                ->sum('submitted_amount_npr'),

            'approved_payments' => Payment::query()->approved()->count(),
        ];
    }

    /**
     * Health of the moving parts. Integration health is derived from the last
     * day of recorded events rather than a live probe, so rendering the
     * dashboard never blocks on a third-party call.
     */
    protected function services(): array
    {
        return [
            [
                'name' => 'Web application',
                'health_percent' => 100,
                'status' => 'Operational',
            ],
            [
                'name' => 'Laravel API',
                'health_percent' => 100,
                'status' => $this->settings->bool('operations.maintenance_notice')
                    ? 'Maintenance'
                    : 'Operational',
            ],
            $this->integrationHealth('Zoom integration', IntegrationProvider::Zoom),
            $this->integrationHealth('YouTube integration', IntegrationProvider::Youtube),
        ];
    }

    protected function integrationHealth(string $name, IntegrationProvider $provider): array
    {
        $enabled = $this->settings->bool('integrations.'.$provider->value.'_enabled', false);

        if (! $enabled) {
            return ['name' => $name, 'health_percent' => 0, 'status' => 'Not connected'];
        }

        $recent = IntegrationEvent::query()
            ->where('provider', $provider->value)
            ->where('occurred_at', '>=', now()->subDay())
            ->get(['status']);

        if ($recent->isEmpty()) {
            return ['name' => $name, 'health_percent' => 100, 'status' => 'Operational'];
        }

        $successful = $recent->where('status', 'success')->count();
        $percent = (int) round($successful / $recent->count() * 100);

        return [
            'name' => $name,
            'health_percent' => $percent,
            'status' => match (true) {
                $percent >= 95 => 'Operational',
                $percent >= 60 => 'Degraded',
                default => 'Failing',
            },
        ];
    }

    protected function audit(): array
    {
        return AuditLog::query()
            ->orderByDesc('occurred_at')
            ->limit(10)
            ->get()
            ->map(fn (AuditLog $entry) => [
                'id' => $entry->id,
                'actor_label' => $entry->actor_label ?? 'System',
                'action' => $entry->action,
                'target_label' => $entry->target_label ?? '—',
                'occurred_at' => $entry->occurred_at->toIso8601String(),
                'reason' => $entry->reason,
            ])
            ->all();
    }

    /**
     * Go-live checklist expressed as four percentages, so a fresh install shows
     * the administrator what is still unconfigured instead of a blank page.
     */
    protected function readiness(): array
    {
        $institution = $this->settings->group('institution');

        $brand = $this->score([
            filled($institution['name'] ?? null) && $institution['name'] !== 'Institution LMS',
            filled($institution['logo_path'] ?? null),
            filled($institution['support_email'] ?? null),
            filled($institution['primary_phone'] ?? null),
            filled($institution['address'] ?? null),
        ]);

        $launchData = $this->score([
            Category::query()->where('is_active', true)->exists(),
            Course::query()->publiclyVisible()->exists(),
            Batch::query()->enrollable()->exists(),
            User::query()->withRole(RoleKey::Teacher)->exists(),
            ClassSession::query()->exists(),
        ]);

        $policies = $this->score([
            // A configured payment method means real account details, not the
            // blank placeholders the seeder creates.
            PaymentMethod::query()->where('is_active', true)->whereNotNull('account_identifier')->exists(),
            $this->settings->bool('security.privileged_mfa', true),
            $this->settings->int('security.failed_login_attempts', 5) > 0,
            $this->settings->bool('operations.automatic_receipts', true),
            User::query()->withRole(RoleKey::Staff)->exists(),
        ]);

        $technical = $this->score([
            $this->settings->bool('integrations.zoom_enabled', false),
            $this->settings->bool('integrations.youtube_enabled', false),
            config('session.driver') === 'database',
            config('queue.default') !== 'sync',
            app()->isProduction() ? ! config('app.debug') : true,
        ]);

        return [
            'brand' => $brand,
            'launch_data' => $launchData,
            'policies' => $policies,
            'technical' => $technical,
        ];
    }

    /** @param  array<int, bool>  $checks */
    protected function score(array $checks): int
    {
        if ($checks === []) {
            return 0;
        }

        return (int) round(count(array_filter($checks)) / count($checks) * 100);
    }
}
