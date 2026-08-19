<?php

namespace Database\Seeders;

use App\Enums\RoleKey;
use App\Enums\UserStatus;
use App\Models\User;
use App\Services\UserDirectory;
use Illuminate\Database\Seeder;

/**
 * One predictable account per role, all sharing the same password, so every
 * portal can be clicked through without juggling separate credentials.
 *
 *   php artisan db:seed --class=Database\\Seeders\\TestAccountsSeeder
 *
 * Never run automatically: DatabaseSeeder does not call this. A known,
 * shared password across five accounts is a deliberate testing convenience,
 * not something a production install should ever have.
 */
class TestAccountsSeeder extends Seeder
{
    protected const PASSWORD = 'password123';

    public function run(UserDirectory $directory): void
    {
        if (app()->isProduction() && ! $this->command?->confirm('This is a production environment. Really seed shared-password test accounts?')) {
            $this->command?->warn('Skipped.');

            return;
        }

        $accounts = [
            ['role' => RoleKey::SuperAdmin, 'email' => 'superadmin@example.com', 'name' => 'Super Admin'],
            ['role' => RoleKey::Admin, 'email' => 'admin@example.com', 'name' => 'Admin'],
            ['role' => RoleKey::Staff, 'email' => 'staff@example.com', 'name' => 'Staff'],
            ['role' => RoleKey::Teacher, 'email' => 'teacher@example.com', 'name' => 'Teacher'],
            ['role' => RoleKey::Student, 'email' => 'student@example.com', 'name' => 'Student'],
        ];

        foreach ($accounts as $account) {
            // updateOrCreate rather than firstOrCreate: superadmin@example.com
            // may already exist from AdministratorSeeder with a random,
            // forced-change password. This seeder is the one place the
            // shared testing password is guaranteed, so it always wins.
            $user = User::updateOrCreate(['email' => $account['email']], [
                'name' => $account['name'],
                'password' => self::PASSWORD,
                'status' => UserStatus::Active->value,

                // These are for repeated local testing, not a real institution
                // — no forced password change, no email verification hoop.
                'must_change_password' => false,
            ]);

            $user->forceFill(['email_verified_at' => now()])->save();

            $directory->assignRole($user, $account['role'], primary: true);
        }

        $this->command?->warn('Test accounts ready. Every account uses the password: '.self::PASSWORD);
        foreach ($accounts as $account) {
            $this->command?->line(sprintf('  %-24s %s', $account['email'], $account['role']->label()));
        }
    }
}
