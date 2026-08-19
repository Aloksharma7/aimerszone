<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Grants students the permissions the portal navigation already expected.
     *
     * Without these the Explore and Payments items were silently hidden, so a
     * student could not find a course without leaving the portal for the public
     * site. The role seeder only fills empty roles, so an existing install
     * needs this backfill rather than a re-seed.
     */
    public function up(): void
    {
        $role = Role::where('key', 'student')->first();

        if ($role === null) {
            return;
        }

        $keys = ['courses.view', 'batches.view', 'payments.view', 'receipts.view', 'support.view'];

        $role->permissions()->syncWithoutDetaching(
            Permission::whereIn('key', $keys)->pluck('id'),
        );
    }

    public function down(): void
    {
        $role = Role::where('key', 'student')->first();

        if ($role === null) {
            return;
        }

        $role->permissions()->detach(
            Permission::whereIn('key', ['courses.view', 'batches.view', 'payments.view', 'receipts.view', 'support.view'])->pluck('id'),
        );
    }
};
