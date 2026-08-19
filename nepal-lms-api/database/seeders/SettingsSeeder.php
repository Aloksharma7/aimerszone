<?php

namespace Database\Seeders;

use App\Services\SettingsRepository;
use Illuminate\Database\Seeder;

/**
 * Writes config/lms.php defaults into the settings table so the administrator
 * screen has real rows to edit. Existing values are never overwritten.
 */
class SettingsSeeder extends Seeder
{
    public function run(SettingsRepository $settings): void
    {
        foreach ((array) config('lms.settings', []) as $group => $pairs) {
            foreach ((array) $pairs as $key => $value) {
                $exists = \App\Models\Setting::where('group', $group)->where('key', $key)->exists();

                if ($exists) {
                    continue;
                }

                // Only institution identity is public. Secrets seed as null and
                // are written encrypted when the administrator pastes them.
                $settings->set(
                    $group,
                    $key,
                    $value,
                    isPublic: $group === 'institution',
                    encrypt: in_array("{$group}.{$key}", ['sms.token', 'esewa.secret_key'], true) && filled($value),
                );
            }
        }

        $settings->flush();
    }
}
