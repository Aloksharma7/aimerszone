<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use App\Services\AuditLogger;
use App\Services\FeatureGate;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use App\Support\PublicAssetUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * The administrator control panel behind /admin/settings.
 *
 * Everything the frontend used to read from NEXT_PUBLIC_* variables — identity,
 * security thresholds, operational switches — is stored here and changeable at
 * runtime. Every save writes an audit entry naming the changed keys.
 */
class SettingsController extends Controller
{
    public function __construct(
        protected SettingsRepository $settings,
        protected FeatureGate $features,
        protected AuditLogger $audit,
    ) {}

    public function show(): JsonResponse
    {
        return ApiResponse::item([
            'institution' => [
                'name' => $this->settings->string('institution.name'),
                'short_name' => $this->settings->string('institution.short_name'),
                'tagline' => $this->settings->string('institution.tagline'),
                'primary_phone' => $this->settings->string('institution.primary_phone'),
                'support_email' => $this->settings->string('institution.support_email'),
                'whatsapp' => $this->settings->string('institution.whatsapp'),
                'website' => $this->settings->string('institution.website'),
                'address' => $this->settings->string('institution.address'),
                'logo_url' => $this->assetUrl($this->settings->get('institution.logo_path')),
                'favicon_url' => $this->assetUrl($this->settings->get('institution.favicon_path')),
                'facebook_url' => $this->settings->string('institution.facebook_url'),
                'instagram_url' => $this->settings->string('institution.instagram_url'),
                'youtube_url' => $this->settings->string('institution.youtube_url'),
            ],
            'payment_methods' => PaymentMethod::orderBy('sort_order')->get()->map(fn (PaymentMethod $method) => [
                'id' => $method->id,
                'name' => $method->name,
                'account_name' => $method->account_name,
                'account_reference' => $method->account_identifier,
                'bank_name' => $method->bank_name,
                'branch' => $method->branch,
                'qr_image_url' => $method->qrImageUrl(),
                'status' => $method->is_active ? 'active' : 'disabled',
                'sort_order' => (int) $method->sort_order,
            ])->all(),
            'security' => [
                'public_registration' => $this->settings->bool('security.public_registration', true),
                'email_verification' => $this->settings->bool('security.email_verification'),
                'privileged_mfa' => $this->settings->bool('security.privileged_mfa', true),
                'force_password_change' => $this->settings->bool('security.force_password_change', true),
                'session_timeout_hours' => $this->settings->int('security.session_timeout_hours', 8),
                'failed_login_attempts' => $this->settings->int('security.failed_login_attempts', 5),
                'lockout_minutes' => $this->settings->int('security.lockout_minutes', 15),
            ],
            'operations' => [
                'maintenance_notice' => $this->settings->bool('operations.maintenance_notice'),
                'automatic_receipts' => $this->settings->bool('operations.automatic_receipts', true),
                'daily_integration_health_check' => $this->settings->bool('operations.daily_integration_health_check', true),
            ],

            /*
             * Each feature reports whether it is switched on AND whether it can
             * actually run, so the panel can show "on but waiting for a token"
             * rather than pretending it works.
             */
            'features' => $this->features->status(),

            'sms' => [
                'provider' => $this->settings->string('sms.provider', 'sparrow'),
                'endpoint' => $this->settings->string('sms.endpoint'),
                'sender_id' => $this->settings->string('sms.sender_id'),

                // The token itself is never returned once stored.
                'token_configured' => filled($this->settings->get('sms.token')),

                'notify_class_starting' => $this->settings->bool('sms.notify_class_starting', true),
                'notify_payment_decision' => $this->settings->bool('sms.notify_payment_decision', true),
                'notify_enrollment_activated' => $this->settings->bool('sms.notify_enrollment_activated', true),
            ],

            'esewa' => [
                'environment' => $this->settings->string('esewa.environment', 'sandbox'),
                'merchant_code' => $this->settings->string('esewa.merchant_code'),
                'secret_key_configured' => filled($this->settings->get('esewa.secret_key')),
            ],

            'content' => [
                'watermark_opacity' => $this->settings->int('content.watermark_opacity', 18),
                'watermark_interval_seconds' => $this->settings->int('content.watermark_interval_seconds', 12),
            ],
        ]);
    }

    /**
     * Persists provider settings, keeping secrets out of the normal path.
     *
     * @return array<int, string> Changed paths, for the audit entry.
     */
    protected function storeSecrets(array $data, string $actorId): array
    {
        $changed = [];

        $plain = [
            'sms' => ['provider', 'endpoint', 'sender_id', 'notify_class_starting', 'notify_payment_decision', 'notify_enrollment_activated'],
            'esewa' => ['environment', 'merchant_code'],
        ];

        foreach ($plain as $group => $keys) {
            foreach ($keys as $key) {
                if (! array_key_exists($key, $data[$group] ?? [])) {
                    continue;
                }

                $this->settings->set($group, $key, $data[$group][$key], updatedBy: $actorId);
                $changed[] = "{$group}.{$key}";
            }
        }

        $secrets = ['sms' => 'token', 'esewa' => 'secret_key'];

        foreach ($secrets as $group => $key) {
            $value = $data[$group][$key] ?? null;

            // Blank means "unchanged", not "delete".
            if (blank($value)) {
                continue;
            }

            $this->settings->set($group, $key, $value, encrypt: true, updatedBy: $actorId);

            // The value itself never reaches the audit log.
            $changed[] = "{$group}.{$key} (secret updated)";
        }

        return $changed;
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'institution' => ['sometimes', 'array'],
            'institution.name' => ['required_with:institution', 'string', 'min:2', 'max:120'],
            'institution.short_name' => ['nullable', 'string', 'max:12'],
            'institution.tagline' => ['nullable', 'string', 'max:160'],
            'institution.primary_phone' => ['nullable', 'string', 'max:32'],
            'institution.support_email' => ['nullable', 'email:filter', 'max:190'],
            'institution.whatsapp' => ['nullable', 'string', 'max:20'],
            'institution.website' => ['nullable', 'url', 'max:190'],
            'institution.address' => ['nullable', 'string', 'max:255'],
            'institution.facebook_url' => ['nullable', 'url', 'max:190'],
            'institution.instagram_url' => ['nullable', 'url', 'max:190'],
            'institution.youtube_url' => ['nullable', 'url', 'max:190'],

            'security' => ['sometimes', 'array'],
            'security.public_registration' => ['boolean'],
            'security.email_verification' => ['boolean'],
            'security.privileged_mfa' => ['boolean'],
            'security.force_password_change' => ['boolean'],
            'security.session_timeout_hours' => ['integer', 'min:1', 'max:24'],
            'security.failed_login_attempts' => ['integer', 'min:3', 'max:20'],
            'security.lockout_minutes' => ['integer', 'min:5', 'max:1440'],

            'operations' => ['sometimes', 'array'],
            'operations.maintenance_notice' => ['boolean'],
            'operations.automatic_receipts' => ['boolean'],
            'operations.daily_integration_health_check' => ['boolean'],

            'features' => ['sometimes', 'array'],
            'features.single_device_login' => ['boolean'],
            'features.dynamic_watermark' => ['boolean'],
            'features.sms_notifications' => ['boolean'],
            'features.esewa_checkout' => ['boolean'],
            'features.student_support_tickets' => ['boolean'],
            'features.public_free_courses' => ['boolean'],

            'sms' => ['sometimes', 'array'],
            'sms.provider' => [Rule::in(['sparrow', 'generic'])],
            'sms.endpoint' => ['url', 'max:255'],
            'sms.sender_id' => ['string', 'max:20'],

            // Write-only: an empty string means "leave the stored token alone",
            // so saving the form without retyping the secret does not wipe it.
            'sms.token' => ['nullable', 'string', 'max:255'],

            'sms.notify_class_starting' => ['boolean'],
            'sms.notify_payment_decision' => ['boolean'],
            'sms.notify_enrollment_activated' => ['boolean'],

            'esewa' => ['sometimes', 'array'],
            'esewa.environment' => [Rule::in(['sandbox', 'live'])],
            'esewa.merchant_code' => ['string', 'max:60'],
            'esewa.secret_key' => ['nullable', 'string', 'max:255'],

            'content' => ['sometimes', 'array'],
            'content.watermark_opacity' => ['integer', 'min:5', 'max:60'],
            'content.watermark_interval_seconds' => ['integer', 'min:4', 'max:120'],

            'payment_methods' => ['sometimes', 'array', 'max:20'],
            'payment_methods.*.id' => ['required', 'string', Rule::exists('payment_methods', 'id')],
            'payment_methods.*.name' => ['required', 'string', 'max:80'],
            'payment_methods.*.account_name' => ['nullable', 'string', 'max:120'],
            'payment_methods.*.account_reference' => ['nullable', 'string', 'max:120'],
            'payment_methods.*.bank_name' => ['nullable', 'string', 'max:120'],
            'payment_methods.*.branch' => ['nullable', 'string', 'max:120'],
            'payment_methods.*.status' => ['required', Rule::in(['active', 'disabled'])],
            'payment_methods.*.sort_order' => ['integer', 'min:0', 'max:999'],
        ]);

        $actor = $request->user();

        $changed = DB::transaction(function () use ($data, $actor) {
            $changed = $this->settings->setMany(
                collect($data)
                    ->only(['institution', 'security', 'operations', 'features', 'content'])
                    ->all(),
                $actor->getKey(),
            );

            // Secrets are handled separately: encrypted at rest, and a blank
            // submission leaves the stored value untouched rather than clearing
            // it, so an administrator editing the sender ID does not
            // accidentally disable SMS.
            $changed = array_merge($changed, $this->storeSecrets($data, $actor->getKey()));

            foreach ($data['payment_methods'] ?? [] as $method) {
                PaymentMethod::whereKey($method['id'])->update([
                    'name' => $method['name'],
                    'account_name' => $method['account_name'] ?? null,
                    'account_identifier' => $method['account_reference'] ?? null,
                    'bank_name' => $method['bank_name'] ?? null,
                    'branch' => $method['branch'] ?? null,
                    'is_active' => $method['status'] === 'active',
                    'sort_order' => $method['sort_order'] ?? 0,
                ]);

                $changed[] = 'payment_method:'.$method['id'];
            }

            return $changed;
        });

        if ($changed !== []) {
            $this->audit->log(
                'settings.updated',
                actor: $actor,
                reason: 'Administrator settings change',
                properties: ['changed' => $changed],
                targetLabel: 'Institution settings',
            );
        }

        return $this->show();
    }

    /**
     * A payment method's QR is a scan-to-pay image, not form data, so it
     * travels as a file upload rather than through the settings PATCH.
     */
    public function uploadPaymentMethodQr(Request $request, PaymentMethod $paymentMethod): JsonResponse
    {
        $maxKb = (int) config('lms.uploads.image_max_kb', 2048);

        $request->validate([
            'qr_image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.$maxKb],
        ]);

        $previous = $paymentMethod->qr_image_path;
        $path = $request->file('qr_image')->store('payment-methods/qr', 'public');

        $paymentMethod->forceFill(['qr_image_path' => $path])->save();

        // Deleted only after the new file is safely stored and saved, so a
        // failure midway never leaves the method with no QR at all.
        if ($previous) {
            Storage::disk('public')->delete($previous);
        }

        $this->audit->log(
            'settings.payment_method_qr_updated',
            $paymentMethod,
            $request->user(),
            targetLabel: $paymentMethod->name,
        );

        return ApiResponse::item(['qr_image_url' => $paymentMethod->qrImageUrl()]);
    }

    public function deletePaymentMethodQr(Request $request, PaymentMethod $paymentMethod): JsonResponse
    {
        if ($paymentMethod->qr_image_path) {
            Storage::disk('public')->delete($paymentMethod->qr_image_path);
            $paymentMethod->forceFill(['qr_image_path' => null])->save();

            $this->audit->log(
                'settings.payment_method_qr_removed',
                $paymentMethod,
                $request->user(),
                targetLabel: $paymentMethod->name,
            );
        }

        return ApiResponse::message('QR image removed.');
    }

    public function uploadInstitutionLogo(Request $request): JsonResponse
    {
        $maxKb = (int) config('lms.uploads.image_max_kb', 2048);

        $request->validate([
            'logo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp,svg', 'max:'.$maxKb],
        ]);

        $url = $this->replaceBrandAsset($request, 'logo', 'branding/logo');

        return ApiResponse::item(['logo_url' => $url]);
    }

    public function deleteInstitutionLogo(Request $request): JsonResponse
    {
        $this->removeBrandAsset($request, 'logo');

        return ApiResponse::message('Logo removed.');
    }

    /**
     * Favicons skip the `image` rule (it rejects .ico) and use a much smaller
     * cap — nothing legitimate needs more than a few hundred KB for one.
     */
    public function uploadInstitutionFavicon(Request $request): JsonResponse
    {
        $maxKb = (int) config('lms.uploads.favicon_max_kb', 512);

        $request->validate([
            'favicon' => ['required', 'file', 'mimes:png,svg,ico,webp', 'max:'.$maxKb],
        ]);

        $url = $this->replaceBrandAsset($request, 'favicon', 'branding/favicon');

        return ApiResponse::item(['favicon_url' => $url]);
    }

    public function deleteInstitutionFavicon(Request $request): JsonResponse
    {
        $this->removeBrandAsset($request, 'favicon');

        return ApiResponse::message('Favicon removed.');
    }

    /** @param  'logo'|'favicon'  $asset */
    protected function replaceBrandAsset(Request $request, string $asset, string $directory): ?string
    {
        $settingKey = "{$asset}_path";
        $previous = $this->settings->get("institution.{$settingKey}");

        $path = $request->file($asset)->store($directory, 'public');

        $this->settings->set('institution', $settingKey, $path, isPublic: true, updatedBy: $request->user()->getKey());

        // Deleted only after the new file is safely stored and the setting
        // saved, so a failure midway never leaves the institution with none.
        if ($previous) {
            Storage::disk('public')->delete($previous);
        }

        $this->audit->log(
            "settings.institution_{$asset}_updated",
            actor: $request->user(),
            targetLabel: 'Institution settings',
        );

        return $this->assetUrl($path);
    }

    /** @param  'logo'|'favicon'  $asset */
    protected function removeBrandAsset(Request $request, string $asset): void
    {
        $settingKey = "{$asset}_path";
        $previous = $this->settings->get("institution.{$settingKey}");

        if (! $previous) {
            return;
        }

        Storage::disk('public')->delete($previous);
        $this->settings->set('institution', $settingKey, null, isPublic: true, updatedBy: $request->user()->getKey());

        $this->audit->log(
            "settings.institution_{$asset}_removed",
            actor: $request->user(),
            targetLabel: 'Institution settings',
        );
    }

    protected function assetUrl(?string $path): ?string
    {
        return PublicAssetUrl::for($path);
    }
}
