<?php

namespace Database\Seeders;

use App\Models\PaymentMethod;
use Illuminate\Database\Seeder;

/**
 * Creates the three methods used in Nepal with empty account details.
 * The administrator fills in the real account numbers and uploads the QR
 * images from /admin/settings before the site goes live.
 */
class PaymentMethodSeeder extends Seeder
{
    public function run(): void
    {
        $methods = [
            ['key' => 'esewa', 'name' => 'eSewa', 'sort_order' => 1, 'instructions' => 'Send the exact amount to the published eSewa account and upload the payment screenshot.'],
            ['key' => 'khalti', 'name' => 'Khalti', 'sort_order' => 2, 'instructions' => 'Send the exact amount to the published Khalti account and upload the payment screenshot.'],
            ['key' => 'bank-transfer', 'name' => 'Bank transfer', 'sort_order' => 3, 'instructions' => 'Transfer the exact amount to the published bank account and upload the deposit voucher.'],
        ];

        foreach ($methods as $method) {
            PaymentMethod::firstOrCreate(['key' => $method['key']], $method + ['is_active' => true]);
        }
    }
}
