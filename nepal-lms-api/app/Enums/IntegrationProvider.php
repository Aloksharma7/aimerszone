<?php

namespace App\Enums;

enum IntegrationProvider: string
{
    case Zoom = 'zoom';
    case Youtube = 'youtube';

    // Notification delivery, configured from the admin panel.
    case Sms = 'sms';

    // Push notifications via Expo — no admin configuration needed, unlike Sms.
    case Push = 'push';

    // Payment gateway, configured from the admin panel.
    case Esewa = 'esewa';

    public function label(): string
    {
        return match ($this) {
            self::Zoom => 'Zoom',
            self::Youtube => 'Youtube',
            self::Sms => 'Sms',
            self::Push => 'Push',
            self::Esewa => 'Esewa',
        };
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
