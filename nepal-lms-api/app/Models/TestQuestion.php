<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;


class TestQuestion extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'test_id',
        'order',
        'type',
        'prompt',
        'marks',
        'negative_marks',
        'explanation',
        'accepted_answers',
    ];

    protected function casts(): array
    {
        return [
            'type' => \App\Enums\QuestionType::class,
            'marks' => 'decimal:2',
            'negative_marks' => 'decimal:2',
            'accepted_answers' => 'array',
        ];
    }

    public function test(): BelongsTo
    {
        return $this->belongsTo(Test::class);
    }

    public function options(): HasMany
    {
        return $this->hasMany(TestOption::class);
    }

    public function correctOptionIds(): array
    {
        return $this->options->where('is_correct', true)->pluck('id')->all();
    }

    /**
     * Normalized answer key for short text.
     *
     * Collapsing whitespace and case is the minimum needed to stop "  Arc  "
     * being marked wrong against "arc"; anything cleverer belongs in a teacher
     * review screen, not in automatic scoring.
     */
    public function acceptedAnswerSet(): array
    {
        return collect($this->accepted_answers ?? [])
            ->map(fn ($answer) => self::normalizeAnswer((string) $answer))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    public static function normalizeAnswer(string $value): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/', ' ', $value) ?? ''));
    }

}
