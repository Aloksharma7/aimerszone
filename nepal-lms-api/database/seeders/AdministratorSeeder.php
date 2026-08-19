<?php

namespace Database\Seeders;

use App\Enums\RoleKey;
use App\Enums\UserStatus;
use App\Models\User;
use App\Services\UserDirectory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Creates the first administrator so the institution can sign in and configure
 * the rest of the platform.
 *
 * The password comes from ADMIN_PASSWORD when present; otherwise a random one
 * is generated and printed once. In both cases the account is flagged to force
 * a password change at first sign-in.
 */
class AdministratorSeeder extends Seeder
{
    public function run(UserDirectory $directory): void
    {
        $email = env('ADMIN_EMAIL', 'superadmin@example.com');

        if (User::where('email', $email)->exists()) {
            $this->command?->info("Administrator {$email} already exists; skipping.");

            return;
        }

        $password = env('ADMIN_PASSWORD') ?: Str::password(16);

        $user = User::create([
            'name' => env('ADMIN_NAME', 'Institution Administrator'),
            'email' => $email,
            'mobile' => env('ADMIN_MOBILE'),
            'password' => $password,
            'status' => UserStatus::Active->value,
            'must_change_password' => true,
            'staff_code' => 'ADM-0001',
        ]);

        // Verification timestamps are deliberately not mass-assignable.
        $user->forceFill(['email_verified_at' => now()])->save();

        $directory->assignRole($user, RoleKey::SuperAdmin, primary: true);

        $this->command?->warn('Administrator created.');
        $this->command?->line("  email:    {$email}");
        $this->command?->line("  password: {$password}");
        $this->command?->line('  This password must be changed at first sign-in.');
    }
}
