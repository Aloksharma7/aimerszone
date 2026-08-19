<?php

namespace App\Services\Integrations;

use App\Models\IntegrationEvent;
use App\Models\Payment;
use App\Services\FeatureGate;
use App\Services\SettingsRepository;
use Illuminate\Support\Str;

/**
 * eSewa ePay v2.
 *
 * eSewa is a redirect-and-verify gateway rather than a server-to-server charge:
 * the student is sent to eSewa with a signed form, pays there, and returns with
 * a signed payload. The signature is what makes the return trustworthy — a
 * student could otherwise craft their own "success" redirect and self-approve a
 * seat, so the returned data is verified against our own secret before anything
 * is activated.
 *
 * Credentials are pasted by the administrator, so moving from eSewa's sandbox
 * to a real merchant account never needs a deployment.
 */
class EsewaClient
{
    protected const SANDBOX_URL = 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';

    protected const LIVE_URL = 'https://epay.esewa.com.np/api/epay/main/v2/form';

    public function __construct(
        protected SettingsRepository $settings,
        protected FeatureGate $features,
    ) {}

    public function isReady(): bool
    {
        return $this->features->esewa();
    }

    public function isSandbox(): bool
    {
        return $this->settings->string('esewa.environment', 'sandbox') !== 'live';
    }

    /**
     * Builds the form the browser posts to eSewa.
     *
     * @return array{action: string, fields: array<string, string>, transaction_uuid: string}
     */
    public function checkout(Payment $payment): array
    {
        $uuid = $this->transactionUuid($payment);
        $amount = (string) $payment->expected_amount_npr;
        $merchant = $this->settings->string('esewa.merchant_code', 'EPAYTEST');

        $frontend = rtrim(config('app.frontend_url'), '/');

        $fields = [
            'amount' => $amount,
            'tax_amount' => '0',

            // eSewa requires total_amount to equal the sum of the parts; the
            // institution charges no separate tax or service fee.
            'total_amount' => $amount,

            'transaction_uuid' => $uuid,
            'product_code' => $merchant,
            'product_service_charge' => '0',
            'product_delivery_charge' => '0',
            'success_url' => $frontend.$this->settings->string('esewa.success_path', '/student/payments/esewa/success'),
            'failure_url' => $frontend.$this->settings->string('esewa.failure_path', '/student/payments/esewa/failure'),
            'signed_field_names' => 'total_amount,transaction_uuid,product_code',
        ];

        $fields['signature'] = $this->sign([
            'total_amount' => $fields['total_amount'],
            'transaction_uuid' => $fields['transaction_uuid'],
            'product_code' => $fields['product_code'],
        ]);

        $this->record('checkout.created', $uuid, 'success', null);

        return [
            'action' => $this->isSandbox() ? self::SANDBOX_URL : self::LIVE_URL,
            'fields' => $fields,
            'transaction_uuid' => $uuid,
        ];
    }

    /**
     * Verifies the base64 payload eSewa appends to the success redirect.
     *
     * Returns null when the payload is malformed, unsigned, or signed with
     * anything other than our secret — all of which are treated identically,
     * because a forged return and a corrupted one both mean "do not activate".
     *
     * @return array{transaction_uuid: string, total_amount: string, status: string, transaction_code: ?string}|null
     */
    public function verifyReturn(string $encoded): ?array
    {
        $decoded = json_decode((string) base64_decode($encoded, true), true);

        if (! is_array($decoded)) {
            $this->record('checkout.verify', null, 'failed', 'Return payload was not decodable.');

            return null;
        }

        $signedNames = explode(',', (string) ($decoded['signed_field_names'] ?? ''));
        $payload = [];

        foreach ($signedNames as $name) {
            $name = trim($name);

            if ($name === '' || ! array_key_exists($name, $decoded)) {
                $this->record('checkout.verify', $decoded['transaction_uuid'] ?? null, 'failed', 'Signed field missing from payload.');

                return null;
            }

            $payload[$name] = (string) $decoded[$name];
        }

        $expected = $this->sign($payload);

        if (! hash_equals($expected, (string) ($decoded['signature'] ?? ''))) {
            // The most important branch in this class: an unverified return is
            // exactly how a student would try to activate a seat without paying.
            $this->record('checkout.verify', $decoded['transaction_uuid'] ?? null, 'failed', 'Signature did not match.');

            return null;
        }

        $this->record('checkout.verify', $decoded['transaction_uuid'] ?? null, 'success', null);

        return [
            'transaction_uuid' => (string) ($decoded['transaction_uuid'] ?? ''),
            'total_amount' => str_replace(',', '', (string) ($decoded['total_amount'] ?? '0')),
            'status' => (string) ($decoded['status'] ?? 'UNKNOWN'),
            'transaction_code' => $decoded['transaction_code'] ?? null,
        ];
    }

    /**
     * Deterministic per payment, so a student who refreshes the checkout page
     * does not create a second eSewa transaction for the same seat.
     */
    public function transactionUuid(Payment $payment): string
    {
        return 'PMT-'.Str::upper(Str::substr($payment->getKey(), -12));
    }

    /** @param array<string, string> $fields Ordered exactly as signed_field_names. */
    protected function sign(array $fields): string
    {
        $message = collect($fields)
            ->map(fn (string $value, string $key) => $key.'='.$value)
            ->implode(',');

        return base64_encode(hash_hmac('sha256', $message, (string) $this->settings->get('esewa.secret_key'), true));
    }

    protected function record(string $action, ?string $reference, string $status, ?string $message): void
    {
        IntegrationEvent::create([
            'provider' => 'esewa',
            'action' => $action,
            'reference' => $reference,
            'status' => $status,
            'message' => $message,
            'occurred_at' => now(),
        ]);
    }
}
