<?php

namespace App\Enums;

enum QuestionType: string
{
    case Single = 'single';
    case Multiple = 'multiple';
    case TrueFalse = 'true_false';
    case ShortText = 'short_text';

    public function label(): string
    {
        return match ($this) {
            self::Single => 'Single',
            self::Multiple => 'Multiple',
            self::TrueFalse => 'True false',
            self::ShortText => 'Short text',
        };
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
