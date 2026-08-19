<?php

namespace App\Policies;

use App\Models\SupportTicket;
use App\Models\User;

/**
 * A ticket is readable by the person who raised it and by staff holding
 * support.view. Nobody else — a ticket body routinely contains a phone number,
 * a payment reference and an account problem.
 *
 * Administrators pass through Gate::before and never reach these methods.
 */
class SupportTicketPolicy
{
    public function view(User $user, SupportTicket $ticket): bool
    {
        return $ticket->user_id === $user->getKey() || $user->hasPermission('support.view');
    }

    /** Replying on the ticket thread. */
    public function reply(User $user, SupportTicket $ticket): bool
    {
        // The person who raised it may keep replying while it is still open.
        if ($ticket->user_id === $user->getKey()) {
            return ! in_array($ticket->status->value, ['resolved', 'closed'], true);
        }

        return $user->hasPermission('support.manage');
    }

    /** Status, priority and assignment are staff-only. */
    public function manage(User $user, SupportTicket $ticket): bool
    {
        return $user->hasPermission('support.manage');
    }
}
