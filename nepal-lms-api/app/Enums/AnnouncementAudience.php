<?php

namespace App\Enums;

enum AnnouncementAudience: string
{
    case All = 'all';
    case Course = 'course';
    case Batch = 'batch';
    case Role = 'role';

    public function label(): string
    {
        return match ($this) {
            self::All => 'All',
            self::Course => 'Course',
            self::Batch => 'Batch',
            self::Role => 'Role',
        };
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
