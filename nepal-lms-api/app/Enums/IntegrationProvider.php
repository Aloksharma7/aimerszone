<?php

namespace App\Enums;

enum IntegrationProvider: string
{
    case Zoom = 'zoom';
    case Youtube = 'youtube';

    // Notification delivery, configured from the admin panel.
    case Sms = 'sms';

    // Payment gateway, configured from the admin panel.
    case Esewa = 'esewa';

    public function label(): string
    {
        return match ($this) {
            self::Zoom => 'Zoom',
            self::Youtube => 'Youtube',
            self::Sms => 'Sms',
            self::Esewa => 'Esewa',
        };
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
