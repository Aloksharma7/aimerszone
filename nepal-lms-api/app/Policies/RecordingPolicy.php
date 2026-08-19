<?php

namespace App\Policies;

use App\Models\Recording;
use App\Models\User;
use App\Services\AccessGuard;

class RecordingPolicy
{
    public function __construct(protected AccessGuard $guard) {}

    /**
     * Students additionally require the recording to be released; an unreleased
     * recording is invisible even to an enrolled student.
     */
    public function view(User $user, Recording $recording): bool
    {
        if ($this->guard->teachesBatch($user, $recording->batch_id) || $user->hasPermission('recordings.manage')) {
            return true;
        }

        return $recording->isReleased() && $this->guard->studentCanAccessBatch($user, $recording->batch_id);
    }

    public function play(User $user, Recording $recording): bool
    {
        return $this->view($user, $recording);
    }

    public function manage(User $user, Recording $recording): bool
    {
        return $user->hasPermission('recordings.manage')
            && ($this->guard->teachesBatch($user, $recording->batch_id) || $user->isAdmin());
    }
}
