<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

/**
 * attendance.reopen was added to config/lms.php's permission catalogue and
 * to admin's default role composition alongside building the "reopen a
 * finalized attendance register" feature — but RolePermissionSeeder only
 * ever seeds a role's permissions once, explicitly skipping any role that
 * already has permission rows, which the live `admin` role always does past
 * the first deploy. Nothing else creates or attaches this permission on an
 * existing database (the deploy script never runs db:seed), so without
 * this migration the reopen feature ships and the UI control for it
 * appears, but every non-super-admin gets refused. Same pattern as
 * 2026_08_25_000100_expand_admin_role_permissions.php.
 */
return new class extends Migration
{
    public function up(): void
    {
        $permission = Permission::firstOrCreate(
            ['key' => 'attendance.reopen'],
            ['group' => 'attendance', 'description' => 'Reopen a finalized attendance register'],
        );

        $admin = Role::where('key', 'admin')->first();

        if ($admin !== null) {
            $admin->permissions()->syncWithoutDetaching([$permission->getKey()]);
        }
    }

    public function down(): void
    {
        $admin = Role::where('key', 'admin')->first();
        $permission = Permission::where('key', 'attendance.reopen')->first();

        if ($admin !== null && $permission !== null) {
            $admin->permissions()->detach($permission->getKey());
        }
    }
};
