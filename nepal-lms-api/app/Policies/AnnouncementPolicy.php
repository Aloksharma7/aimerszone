<?php

namespace App\Policies;

use App\Models\Announcement;
use App\Models\User;
use App\Services\AccessGuard;

class AnnouncementPolicy
{
    public function __construct(protected AccessGuard $guard) {}

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function manage(User $user, ?Announcement $announcement = null): bool
    {
        if (! $user->hasPermission('announcements.manage')) {
            return false;
        }

        // A teacher may only address batches they actually teach.
        if ($announcement?->batch_id && $user->hasRole('teacher') && ! $user->isAdmin()) {
            return $this->guard->teachesBatch($user, $announcement->batch_id);
        }

        return true;
    }
}
