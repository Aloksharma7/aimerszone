<?php

namespace App\Notifications;

use App\Services\SettingsRepository;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Password reset link, queued.
 *
 * Laravel's default is sent synchronously, which puts an SMTP round trip inside
 * the request. On a slow or unreachable mail host that turns "forgot password"
 * into a hanging page — and the timing difference would also reveal which
 * addresses exist, defeating the deliberately uniform response.
 *
 * The link points at the Next.js reset page, not at a Laravel route.
 */
class ResetPassword extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $token) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $institution = app(SettingsRepository::class)->string('institution.name', config('app.name'));
        $minutes = config('auth.passwords.users.expire', 60);

        $url = rtrim(config('app.frontend_url'), '/')
            .'/reset-password?token='.$this->token
            .'&email='.urlencode($notifiable->getEmailForPasswordReset());

        return (new MailMessage)
            ->subject('Reset your '.$institution.' password')
            ->greeting('Hello '.($notifiable->name ?: 'there').',')
            ->line('We received a request to reset the password for your '.$institution.' account.')
            ->action('Choose a new password', $url)
            ->line('This link expires in '.$minutes.' minutes and can be used once.')
            ->line('If you did not request this, no action is needed — your password stays as it is.')
            ->salutation('— '.$institution);
    }
}
