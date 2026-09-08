<?php

namespace App\Policies;

use App\Models\Test;
use App\Models\User;
use App\Services\AccessGuard;

class TestPolicy
{
    public function __construct(protected AccessGuard $guard) {}

    public function view(User $user, Test $test): bool
    {
        if ($this->guard->teachesBatch($user, $test->batch_id) || $user->hasPermission('tests.manage')) {
            return true;
        }

        // Drafts never reach students, even enrolled ones.
        return $test->status->value !== 'draft' && $this->guard->studentCanAccessBatch($user, $test->batch_id);
    }

    /** Correct answers and explanations are only ever sent to this audience. */
    public function viewBuilder(User $user, Test $test): bool
    {
        return $user->hasPermission('tests.manage')
            && ($this->guard->teachesBatch($user, $test->batch_id) || $user->isAdmin());
    }

    public function attempt(User $user, Test $test): bool
    {
        if (! $this->guard->studentCanAccessBatch($user, $test->batch_id)) {
            return false;
        }

        return $test->isOpenNow() || $test->hasResumableAttemptFor($user->getKey());
    }

    public function manage(User $user, Test $test): bool
    {
        return $this->viewBuilder($user, $test);
    }

    /**
     * Publishing puts a graded assessment in front of students; that call
     * belongs to the teacher who actually built and is running it, not to
     * whoever administers the platform. Admin can still edit a draft
     * (`manage`) or review results, just not push it live for a batch it
     * does not teach.
     */
    public function publish(User $user, Test $test): bool
    {
        return $user->hasPermission('tests.manage') && $this->guard->teachesBatch($user, $test->batch_id);
    }
}
