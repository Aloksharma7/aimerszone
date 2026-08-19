<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Enrollment;
use App\Models\User;

/**
 * Single answer to "may this user reach this batch's content?".
 *
 * Policies delegate here so students, teachers and staff are evaluated by the
 * same rule everywhere: an active, in-window enrollment for students; a batch
 * assignment for teachers; an explicit permission for staff.
 */
class AccessGuard
{
    /** The enrollment granting access, or null. */
    public function enrollmentFor(User $user, string $batchId): ?Enrollment
    {
        return Enrollment::query()
            ->where('user_id', $user->getKey())
            ->where('batch_id', $batchId)
            ->accessible()
            ->first();
    }

    public function studentCanAccessBatch(User $user, string $batchId): bool
    {
        return $this->enrollmentFor($user, $batchId) !== null;
    }

    public function teachesBatch(User $user, string $batchId): bool
    {
        return Batch::query()
            ->whereKey($batchId)
            ->where(fn ($query) => $query
                ->whereHas('teachers', fn ($builder) => $builder->where('users.id', $user->getKey()))
                ->orWhereHas('sessions', fn ($builder) => $builder->where('teacher_id', $user->getKey())))
            ->exists();
    }

    /** Any route into the batch: enrolled student, assigned teacher, or staff. */
    public function canReachBatch(User $user, string $batchId, string $staffPermission = 'batches.view'): bool
    {
        return $user->isAdmin()
            || $this->studentCanAccessBatch($user, $batchId)
            || $this->teachesBatch($user, $batchId)
            || $user->hasPermission($staffPermission);
    }

    /** @return array<int, string> Batch ids the student currently holds access to. */
    public function accessibleBatchIds(User $user): array
    {
        return Enrollment::query()
            ->where('user_id', $user->getKey())
            ->accessible()
            ->pluck('batch_id')
            ->all();
    }

    /** @return array<int, string> Batch ids the teacher is assigned to. */
    public function taughtBatchIds(User $user): array
    {
        /*
         * Administrators oversee every batch.
         *
         * resolveBatch() already let an administrator open any single batch,
         * but this list scope did not, so every teacher screen an administrator
         * reached — classes, attendance, content, the teacher dashboard —
         * came back completely empty. The two must agree.
         */
        if ($user->isAdmin()) {
            return Batch::query()->pluck('id')->all();
        }

        return Batch::query()
            ->whereHas('teachers', fn ($builder) => $builder->where('users.id', $user->getKey()))
            ->pluck('id')
            ->all();
    }
}
