<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

/**
 * config/lms.php's admin permission list changed (added settings.manage,
 * roles.manage, integrations.manage; dropped sessions.start), but
 * RolePermissionSeeder only ever seeds a role's permissions once — it
 * explicitly skips any role that already has permission rows, which the
 * live `admin` role always does past the first deploy. Editing the config
 * alone would silently do nothing on any database that already exists;
 * this applies the same change directly, once, everywhere the seeder
 * cannot reach it again.
 */
return new class extends Migration
{
    public function up(): void
    {
        $admin = Role::where('key', 'admin')->first();

        if ($admin === null) {
            return;
        }

        $grant = Permission::whereIn('key', ['settings.manage', 'roles.manage', 'integrations.manage'])
            ->pluck('id');
        $admin->permissions()->syncWithoutDetaching($grant);

        $revoke = Permission::where('key', 'sessions.start')->pluck('id');
        $admin->permissions()->detach($revoke);
    }

    public function down(): void
    {
        $admin = Role::where('key', 'admin')->first();

        if ($admin === null) {
            return;
        }

        $revoke = Permission::whereIn('key', ['settings.manage', 'roles.manage', 'integrations.manage'])
            ->pluck('id');
        $admin->permissions()->detach($revoke);

        $grant = Permission::where('key', 'sessions.start')->pluck('id');
        $admin->permissions()->syncWithoutDetaching($grant);
    }
};
