<?php

namespace App\Enums;

enum RecordingState: string
{
    case Processing = 'processing';
    case Available = 'available';
    case Unavailable = 'unavailable';

    public function label(): string
    {
        return match ($this) {
            self::Processing => 'Processing',
            self::Available => 'Available',
            self::Unavailable => 'Unavailable',
        };
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
