<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Controller;
use App\Services\FeatureGate;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * Institution identity for the public site header, footer and contact page.
 *
 * These values used to be NEXT_PUBLIC_* environment variables; serving them
 * here is what makes the branding administrator-editable without a redeploy.
 */
class SettingsController extends Controller
{
    public function __construct(
        protected SettingsRepository $settings,
        protected FeatureGate $features,
    ) {}

    public function __invoke(): JsonResponse
    {
        $institution = $this->settings->group('institution');

        return ApiResponse::item([
            'institution_name' => $institution['name'] ?? config('app.name'),
            'short_name' => $institution['short_name'] ?? null,
            'tagline' => $institution['tagline'] ?? null,
            'logo_url' => $institution['logo_url'] ?? null,
            'timezone' => 'Asia/Kathmandu',
            'currency' => 'NPR',
            'address' => $institution['address'] ?? null,
            'map_url' => $institution['map_url'] ?? null,
            'website' => $institution['website'] ?? null,
            'support' => [
                'whatsapp' => $institution['whatsapp'] ?? null,
                'phone' => $institution['primary_phone'] ?? null,
                'email' => $institution['support_email'] ?? null,
                'hours' => $institution['support_hours'] ?? null,
            ],
            'registration_open' => $this->settings->bool('security.public_registration', true),

            /*
             * Student-facing switches, so the interface can hide what is off
             * rather than offering a button that returns an error. Only these
             * are public; internal toggles stay in the admin payload.
             */
            'features' => [
                'esewa_checkout' => $this->features->esewa(),
                'support_tickets' => $this->features->supportTickets(),
                'free_courses' => $this->features->freeCourses(),
                'single_device_login' => $this->features->singleDeviceLogin(),
            ],
            'maintenance_notice' => $this->settings->bool('operations.maintenance_notice', false)
                ? $this->settings->string('operations.maintenance_message')
                : null,
        ]);
    }
}
