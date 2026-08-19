<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Additively reconciles every default role with config/lms.php.
     *
     * The earlier backfill covered only five of the nine permissions the
     * student navigation checks, so "Recorded Classes", "PDFs & Resources" and
     * "Tests" stayed hidden and their pages hard-denied through
     * requirePermission(). It also returned early on a fresh install, because
     * migrations run before the seeder and the roles table is still empty.
     *
     * This one is safe to run at any point in that order and safe to re-run:
     * it only ever adds, so a deliberately narrowed custom role keeps its
     * removals for anything outside the default set.
     */
    public function up(): void
    {
        // Migrations can run before the seeder, in which case there is nothing
        // to reconcile yet and RolePermissionSeeder does the whole job.
        if (Role::query()->doesntExist()) {
            return;
        }

        foreach ((array) config('lms.permissions.catalogue', []) as $key => $description) {
            Permission::updateOrCreate(
                ['key' => $key],
                ['group' => Str::before($key, '.'), 'description' => $description],
            );
        }

        foreach ((array) config('lms.permissions.roles', []) as $roleKey => $keys) {
            // Administrators hold the wildcard implicitly; no rows are needed.
            if ($roleKey === 'admin') {
                continue;
            }

            $role = Role::where('key', $roleKey)->first();

            if ($role === null) {
                continue;
            }

            $role->permissions()->syncWithoutDetaching(
                Permission::whereIn('key', (array) $keys)->pluck('id'),
            );
        }
    }

    /**
     * Intentionally irreversible. Rolling back would strip permissions that
     * predate this migration, which is a worse outcome than leaving them.
     */
    public function down(): void
    {
        //
    }
};
