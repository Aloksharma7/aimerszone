<?php

namespace App\Enums;

enum AdjustmentType: string
{
    case Discount = 'discount';
    case Waiver = 'waiver';
    case Correction = 'correction';
    case Penalty = 'penalty';

    public function label(): string
    {
        return match ($this) {
            self::Discount => 'Discount',
            self::Waiver => 'Waiver',
            self::Correction => 'Correction',
            self::Penalty => 'Penalty',
        };
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
