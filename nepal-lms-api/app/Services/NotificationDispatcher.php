<?php

namespace App\Services;

use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\SupportTicket;
use App\Models\User;
use App\Services\Integrations\SmsClient;

/**
 * Decides what students are told, and over which channel.
 *
 * Kept in one place so message wording, the institution's name and the
 * per-event switches live together rather than being scattered across the
 * controllers that happen to trigger them.
 *
 * Every method is best effort: notification failure never propagates back into
 * the action that caused it.
 */
class NotificationDispatcher
{
    public function __construct(
        protected SmsClient $sms,
        protected SettingsRepository $settings,
    ) {}

    /**
     * A staff reply on a support ticket.
     *
     * Gated on the same SMS preference as the rest: when SMS is off or the
     * student has no mobile on file, the reply still lands on the ticket
     * thread, which is where they will look.
     */
    /**
     * Access is ending.
     *
     * Deliberately says what is about to happen and by when, rather than only
     * that something is expiring — a student who paid needs to know whether to
     * renew or to finish the material first.
     */
    public function accessEndingSoon(Enrollment $enrollment): void
    {
        if (! $this->wants('sms.notify_access_expiring')) {
            return;
        }

        $student = $enrollment->user;

        if ($student === null || blank($student->mobile) || $enrollment->access_end_at === null) {
            return;
        }

        $this->sms->send(
            $student->mobile,
            sprintf(
                '%s: your access to %s ends on %s. Contact us to extend it.',
                $this->institution(),
                $enrollment->course?->title ?? 'your course',
                $enrollment->access_end_at->timezone('Asia/Kathmandu')->format('j M Y'),
            ),
            'enrollment.expiring',
        );
    }

    public function supportReplied(SupportTicket $ticket): void
    {
        if (! $this->wants('sms.notify_support_reply')) {
            return;
        }

        $student = $ticket->user;

        if ($student === null || blank($student->mobile)) {
            return;
        }

        $this->sms->send(
            $student->mobile,
            sprintf(
                '%s: there is a reply on your support request %s. Sign in to read it.',
                $this->institution(),
                $ticket->reference,
            ),
            'support.replied',
        );
    }

    public function paymentApproved(Payment $payment): void
    {
        if (! $this->wants('sms.notify_payment_decision')) {
            return;
        }

        $student = $payment->user;

        if ($student === null || blank($student->mobile)) {
            return;
        }

        $this->sms->send(
            $student->mobile,
            sprintf(
                '%s: your payment of NPR %s has been approved. Your seat in %s is now active.',
                $this->institution(),
                number_format($payment->submitted_amount_npr),
                $payment->course?->title ?? 'your course',
            ),
            'payment.approved',
        );
    }

    public function paymentRejected(Payment $payment, string $reason): void
    {
        if (! $this->wants('sms.notify_payment_decision')) {
            return;
        }

        $student = $payment->user;

        if ($student === null || blank($student->mobile)) {
            return;
        }

        $this->sms->send(
            $student->mobile,
            sprintf(
                '%s: your payment could not be approved. Reason: %s. Please submit again from the portal.',
                $this->institution(),
                mb_strimwidth($reason, 0, 90, '...'),
            ),
            'payment.rejected',
        );
    }

    /**
     * Sent when the teacher actually starts, not on a schedule — a message that
     * arrives before the class is genuinely live trains students to ignore it.
     */
    public function classStarted(ClassSession $session): int
    {
        if (! $this->wants('sms.notify_class_starting')) {
            return 0;
        }

        $students = Enrollment::query()
            ->where('batch_id', $session->batch_id)
            ->accessible()
            ->with('user:id,mobile')
            ->get()
            ->pluck('user')
            ->filter(fn (?User $user) => $user !== null && filled($user->mobile));

        $message = sprintf(
            '%s: your class "%s" has started. Open the portal to join.',
            $this->institution(),
            mb_strimwidth($session->topic, 0, 60, '...'),
        );

        $sent = 0;

        foreach ($students as $student) {
            if ($this->sms->send($student->mobile, $message, 'class.started')) {
                $sent++;
            }
        }

        return $sent;
    }

    public function enrollmentActivated(Enrollment $enrollment): void
    {
        if (! $this->wants('sms.notify_enrollment_activated')) {
            return;
        }

        $student = $enrollment->user;

        if ($student === null || blank($student->mobile)) {
            return;
        }

        $this->sms->send(
            $student->mobile,
            sprintf(
                '%s: you are enrolled in %s. Classes, recordings and notes are now available in the portal.',
                $this->institution(),
                $enrollment->course?->title ?? 'your course',
            ),
            'enrollment.activated',
        );
    }

    protected function wants(string $path): bool
    {
        return $this->sms->isReady() && $this->settings->bool($path, true);
    }

    protected function institution(): string
    {
        return $this->settings->string('institution.short_name')
            ?: $this->settings->string('institution.name', config('app.name'));
    }
}
