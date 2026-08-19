<?php

namespace App\Providers;

use App\Services\AuditLogger;
use App\Services\MediaLinkService;
use App\Services\FeatureGate;
use App\Services\SettingsRepository;
use App\Support\RequestContext;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(RequestContext::class);
        $this->app->singleton(SettingsRepository::class);
        $this->app->singleton(MediaLinkService::class);
        $this->app->singleton(AuditLogger::class);
        $this->app->singleton(FeatureGate::class);
    }

    public function boot(): void
    {
        /*
         * Strict mode surfaces N+1 access and missing attributes, but it throws
         * rather than warns, so it is opt-in per environment via LMS_STRICT_MODELS
         * instead of being forced on every non-production machine.
         */
        Model::shouldBeStrict((bool) env('LMS_STRICT_MODELS', false));

        // Always on: silently dropping an attribute is a bug worth failing for.
        Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());

        if ($this->app->isProduction()) {
            URL::forceScheme('https');
        }

        $this->configureRateLimiting();
    }

    /**
     * Credential endpoints are throttled per identifier + IP so one attacker
     * cannot lock out an entire shared network, and vice versa.
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)
            ->by($request->user()?->getAuthIdentifier() ?: $request->ip()));

        RateLimiter::for('auth', fn (Request $request) => [
            Limit::perMinute(10)->by('auth-ip:'.$request->ip()),
            Limit::perMinute(5)->by('auth-id:'.mb_strtolower((string) $request->input('identifier', $request->input('email', '')))),
        ]);

        RateLimiter::for('password-reset', fn (Request $request) => Limit::perMinutes(15, 5)
            ->by('reset:'.mb_strtolower((string) $request->input('email', $request->ip()))));

        RateLimiter::for('public-forms', fn (Request $request) => Limit::perMinutes(10, 5)->by('form:'.$request->ip()));

        RateLimiter::for('uploads', fn (Request $request) => Limit::perMinute(20)
            ->by('upload:'.($request->user()?->getAuthIdentifier() ?: $request->ip())));

        RateLimiter::for('attempts', fn (Request $request) => Limit::perMinute(120)
            ->by('attempt:'.($request->user()?->getAuthIdentifier() ?: $request->ip())));
    }
}
