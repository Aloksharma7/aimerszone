<?php

namespace App\Services;

use App\Models\ClassSession;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\SupportTicket;
use App\Models\User;
use App\Services\Integrations\PushNotificationClient;
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
        protected PushNotificationClient $push,
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
        $student = $payment->user;

        if ($this->wants('sms.notify_payment_decision') && $student !== null && filled($student->mobile)) {
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

        if ($student !== null && $this->wantsPush('sms.notify_payment_decision')) {
            $this->push->sendToUser(
                $student,
                'Payment approved',
                sprintf('Your payment of NPR %s has been approved. Your seat in %s is now active.', number_format($payment->submitted_amount_npr), $payment->course?->title ?? 'your course'),
                ['type' => 'payment.approved', 'payment_id' => $payment->id],
                'payment.approved',
            );
        }
    }

    public function paymentRejected(Payment $payment, string $reason): void
    {
        $student = $payment->user;

        if ($this->wants('sms.notify_payment_decision') && $student !== null && filled($student->mobile)) {
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

        if ($student !== null && $this->wantsPush('sms.notify_payment_decision')) {
            $this->push->sendToUser(
                $student,
                'Payment could not be approved',
                sprintf('Reason: %s. Please submit again from the app.', mb_strimwidth($reason, 0, 90, '...')),
                ['type' => 'payment.rejected', 'payment_id' => $payment->id],
                'payment.rejected',
            );
        }
    }

    /**
     * Sent when the teacher actually starts, not on a schedule — a message that
     * arrives before the class is genuinely live trains students to ignore it.
     */
    public function classStarted(ClassSession $session): int
    {
        $students = Enrollment::query()
            ->where('batch_id', $session->batch_id)
            ->accessible()
            ->with('user:id,mobile')
            ->get()
            ->pluck('user')
            ->filter(fn (?User $user) => $user !== null);

        $topic = mb_strimwidth($session->topic, 0, 60, '...');
        $sent = 0;

        if ($this->wants('sms.notify_class_starting')) {
            $message = sprintf('%s: your class "%s" has started. Open the portal to join.', $this->institution(), $topic);

            foreach ($students->filter(fn (User $user) => filled($user->mobile)) as $student) {
                if ($this->sms->send($student->mobile, $message, 'class.started')) {
                    $sent++;
                }
            }
        }

        if ($this->wantsPush('sms.notify_class_starting')) {
            foreach ($students as $student) {
                $this->push->sendToUser(
                    $student,
                    'Class started',
                    sprintf('"%s" has started. Open the app to join.', $topic),
                    ['type' => 'class.started', 'session_id' => $session->id],
                    'class.started',
                );
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

    /**
     * Push is an independent channel from SMS — it must fire even when SMS is
     * off or unconfigured, so this reuses the same per-event setting path
     * without going through $this->sms->isReady().
     */
    protected function wantsPush(string $path): bool
    {
        return $this->push->isReady() && $this->settings->bool($path, true);
    }

    protected function institution(): string
    {
        return $this->settings->string('institution.short_name')
            ?: $this->settings->string('institution.name', config('app.name'));
    }
}
