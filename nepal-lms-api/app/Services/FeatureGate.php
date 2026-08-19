<?php

namespace App\Services;

/**
 * Single answer to "is this feature actually usable right now?".
 *
 * A switch on its own is not enough: an administrator can turn SMS on before
 * pasting a provider token, and the honest answer at that moment is still no.
 * Every caller asks this class rather than reading the flag directly, so a
 * half-configured feature degrades quietly instead of throwing at the worst
 * possible moment — mid-class, or mid-payment.
 */
class FeatureGate
{
    public function __construct(protected SettingsRepository $settings) {}

    public function singleDeviceLogin(): bool
    {
        return $this->settings->bool('features.single_device_login', false);
    }

    public function watermark(): bool
    {
        return $this->settings->bool('features.dynamic_watermark', true);
    }

    /** SMS needs a token and a sender id, not just the switch. */
    public function sms(): bool
    {
        return $this->settings->bool('features.sms_notifications', false)
            && filled($this->settings->get('sms.token'))
            && filled($this->settings->get('sms.sender_id'));
    }

    /**
     * eSewa needs a merchant code and secret. The sandbox merchant code is
     * seeded, so only the secret is genuinely missing on a fresh install.
     */
    public function esewa(): bool
    {
        return $this->settings->bool('features.esewa_checkout', false)
            && filled($this->settings->get('esewa.merchant_code'))
            && filled($this->settings->get('esewa.secret_key'));
    }

    public function supportTickets(): bool
    {
        return $this->settings->bool('features.student_support_tickets', true);
    }

    public function freeCourses(): bool
    {
        return $this->settings->bool('features.public_free_courses', true);
    }

    /**
     * What each feature is still waiting for, for the admin panel.
     *
     * @return array<string, array{enabled: bool, ready: bool, missing: array<int, string>}>
     */
    public function status(): array
    {
        return [
            'single_device_login' => $this->describe('features.single_device_login', []),
            'dynamic_watermark' => $this->describe('features.dynamic_watermark', [], default: true),
            'sms_notifications' => $this->describe('features.sms_notifications', [
                'SMS provider token' => 'sms.token',
                'Sender ID' => 'sms.sender_id',
            ]),
            'esewa_checkout' => $this->describe('features.esewa_checkout', [
                'Merchant code' => 'esewa.merchant_code',
                'Secret key' => 'esewa.secret_key',
            ]),
            'student_support_tickets' => $this->describe('features.student_support_tickets', [], default: true),
            'public_free_courses' => $this->describe('features.public_free_courses', [], default: true),
        ];
    }

    /** @param array<string, string> $requires Label => settings path */
    protected function describe(string $flag, array $requires, bool $default = false): array
    {
        $missing = [];

        foreach ($requires as $label => $path) {
            if (blank($this->settings->get($path))) {
                $missing[] = $label;
            }
        }

        return [
            'enabled' => $this->settings->bool($flag, $default),
            'ready' => $missing === [],
            'missing' => $missing,
        ];
    }
}
