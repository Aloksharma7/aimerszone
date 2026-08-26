<?php

namespace App\Policies;

use App\Models\Payment;
use App\Models\User;

class PaymentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('payments.view');
    }

    public function view(User $user, Payment $payment): bool
    {
        return $payment->user_id === $user->getKey() || $user->hasPermission('payments.view');
    }

    /**
     * Evidence is more sensitive than the payment row itself — deliberately
     * NOT the same check as view(). Every student holds payments.view so
     * their own payments list works (query-scoped, per config/lms.php's own
     * comment on the student role), but that same broad grant must not let
     * one student open another student's uploaded evidence. Only the owner,
     * or staff actually reviewing payments (payments.review), may see it.
     */
    public function viewProof(User $user, Payment $payment): bool
    {
        return $payment->user_id === $user->getKey()
            || $user->hasPermission('payments.review');
    }

    public function submit(User $user): bool
    {
        return $user->hasRole('student') || $user->hasPermission('payments.submit');
    }

    /**
     * The officer who submitted evidence must not also approve it, and a
     * payment is only decidable while it is still under review.
     */
    public function review(User $user, Payment $payment): bool
    {
        if (! $user->hasPermission('payments.review') || ! $payment->isReviewable()) {
            return false;
        }

        return $payment->submitted_by !== $user->getKey() || $user->isAdmin();
    }

    public function adjust(User $user): bool
    {
        return $user->hasPermission('payments.adjust');
    }

    public function refund(User $user): bool
    {
        return $user->hasPermission('payments.refund');
    }
}
