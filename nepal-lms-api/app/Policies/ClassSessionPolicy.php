<?php

namespace App\Policies;

use App\Models\ClassSession;
use App\Models\User;
use App\Services\AccessGuard;

class ClassSessionPolicy
{
    public function __construct(protected AccessGuard $guard) {}

    public function view(User $user, ClassSession $session): bool
    {
        return $this->guard->canReachBatch($user, $session->batch_id, 'sessions.view');
    }

    /** Only an enrolled student in the window may request a join destination. */
    public function join(User $user, ClassSession $session): bool
    {
        return $this->guard->studentCanAccessBatch($user, $session->batch_id);
    }

    /** Schedule, sync and fallback-configuration changes: administrative housekeeping. */
    public function manage(User $user, ClassSession $session): bool
    {
        return $user->hasPermission('sessions.manage')
            && ($this->guard->teachesBatch($user, $session->batch_id) || $user->isAdmin());
    }

    /**
     * Starting the live meeting and finalizing attendance are the assigned
     * teacher's own acts — the person actually running the class, not
     * whoever administers the platform. Admin can arrange, reschedule and
     * troubleshoot a session, but does not start it or attest attendance for
     * a class it did not teach.
     */
    public function start(User $user, ClassSession $session): bool
    {
        return $user->hasPermission('sessions.start') && $this->guard->teachesBatch($user, $session->batch_id);
    }

    public function finalizeAttendance(User $user, ClassSession $session): bool
    {
        return $user->hasPermission('attendance.finalize') && $this->guard->teachesBatch($user, $session->batch_id);
    }

    /**
     * Reopening a finalized register is a deliberate administrative
     * override, not the teacher's own act — the same asymmetry as
     * start()/manage(): finalizing is what the assigned teacher does;
     * undoing that decision belongs to whoever administers the platform,
     * with the reason recorded in the audit trail.
     */
    public function reopenAttendance(User $user, ClassSession $session): bool
    {
        return $user->isAdmin() && $user->hasPermission('attendance.reopen');
    }
}
