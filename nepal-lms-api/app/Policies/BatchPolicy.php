<?php

namespace App\Policies;

use App\Models\Batch;
use App\Models\User;
use App\Services\AccessGuard;

class BatchPolicy
{
    public function __construct(protected AccessGuard $guard) {}

    public function viewAny(User $user): bool
    {
        return $user->hasPermission('batches.view') || $user->hasRole('teacher');
    }

    public function view(User $user, Batch $batch): bool
    {
        return $this->guard->canReachBatch($user, $batch->getKey());
    }

    public function manage(User $user, Batch $batch): bool
    {
        return $user->hasPermission('batches.manage');
    }

    public function teach(User $user, Batch $batch): bool
    {
        return $this->guard->teachesBatch($user, $batch->getKey());
    }
}
