<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('users.view') || $user->hasPermission('students.view');
    }

    public function view(User $user, User $target): bool
    {
        return $user->is($target) || $user->hasPermission('users.view') || $user->hasPermission('students.view');
    }

    public function update(User $user, User $target): bool
    {
        // An admin-tier target can only be edited by Super Admin — Admin's
        // users.manage permission is for the accounts it actually runs
        // (staff, teachers, students), not its own tier or above. Editing
        // your own account (e.g. the self-demotion check below) is exempt.
        if (! $user->is($target) && $target->isAdmin() && ! $user->isSuperAdmin()) {
            return false;
        }

        return $user->hasPermission('users.manage');
    }

    /** Suspension, MFA reset and session revocation. */
    public function administer(User $user, User $target): bool
    {
        if (! $user->is($target) && $target->isAdmin() && ! $user->isSuperAdmin()) {
            return false;
        }

        return $user->hasPermission('users.security') && ! $user->is($target);
    }

    /** Archiving (soft-delete). Self-archiving is blocked separately, in the controller. */
    public function delete(User $user, User $target): bool
    {
        if (! $user->is($target) && $target->isAdmin() && ! $user->isSuperAdmin()) {
            return false;
        }

        return $user->hasPermission('users.delete');
    }
}
