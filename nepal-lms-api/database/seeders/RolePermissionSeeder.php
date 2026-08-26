<?php

namespace Database\Seeders;

use App\Enums\RoleKey;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Idempotent: safe to re-run after adding permissions to config/lms.php.
 * Existing custom role compositions are preserved; only empty roles are
 * seeded with their defaults.
 */
class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        foreach ((array) config('lms.permissions.catalogue', []) as $key => $description) {
            Permission::updateOrCreate(
                ['key' => $key],
                ['group' => Str::before($key, '.'), 'description' => $description],
            );
        }

        $names = [
            'student' => 'Student',
            'teacher' => 'Teacher',
            'staff' => 'Staff',
            'admin' => 'Admin',
            'super_admin' => 'Super Admin',
        ];

        $descriptions = [
            'student' => 'Access to enrolled courses, live classes, recordings, resources, tests and payments.',
            'teacher' => 'Manages assigned batches, classes, attendance, recordings, content and assessments.',
            'staff' => 'Onboards students, manages the course catalogue, submits payment evidence and reviews payments, receipts, adjustments and refunds.',
            'admin' => 'Full administrative control: courses, batches, users, content, reports, settings, integrations and role management. Managing another Admin or Super Admin account stays exclusive to Super Admin.',
            'super_admin' => 'Full administrative control including settings, roles, integrations and audit history.',
        ];

        $sort = 0;

        foreach (RoleKey::cases() as $roleKey) {
            $role = Role::updateOrCreate(
                ['key' => $roleKey->value],
                [
                    'name' => $names[$roleKey->value],
                    'description' => $descriptions[$roleKey->value],
                    'portal_home' => $roleKey->portalHome(),
                    'is_protected' => true,
                    'sort_order' => $sort++,
                ],
            );

            // Super Admin holds the wildcard implicitly, so no rows are needed.
            if ($roleKey === RoleKey::SuperAdmin || $role->permissions()->exists()) {
                continue;
            }

            $keys = (array) config("lms.permissions.roles.{$roleKey->value}", []);
            $role->permissions()->sync(Permission::whereIn('key', $keys)->pluck('id'));
        }
    }
}
