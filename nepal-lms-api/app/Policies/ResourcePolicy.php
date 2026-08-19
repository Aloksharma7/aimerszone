<?php

namespace App\Policies;

use App\Models\Resource;
use App\Models\User;
use App\Services\AccessGuard;

class ResourcePolicy
{
    public function __construct(protected AccessGuard $guard) {}

    public function view(User $user, Resource $resource): bool
    {
        if ($resource->is_public && $resource->isReleased()) {
            return true;
        }

        if ($user->hasPermission('resources.manage')) {
            return true;
        }

        if ($resource->batch_id && $this->guard->teachesBatch($user, $resource->batch_id)) {
            return true;
        }

        if (! $resource->isReleased()) {
            return false;
        }

        // Course-wide material is readable by anyone enrolled in any of its batches.
        if ($resource->batch_id) {
            return $this->guard->studentCanAccessBatch($user, $resource->batch_id);
        }

        return $user->enrollments()->accessible()->where('course_id', $resource->course_id)->exists();
    }

    public function download(User $user, Resource $resource): bool
    {
        return $this->view($user, $resource);
    }

    public function manage(User $user, Resource $resource): bool
    {
        return $user->hasPermission('resources.manage');
    }
}
