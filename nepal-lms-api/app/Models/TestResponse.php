<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


class TestResponse extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'test_attempt_id',
        'test_question_id',
        'selected_option_ids',
        'text_answer',
        'is_correct',
        'awarded_marks',
        'answered_at',
        'flagged',
    ];

    protected function casts(): array
    {
        return [
            'selected_option_ids' => 'array',
            'is_correct' => 'boolean',
            'awarded_marks' => 'decimal:2',
            'answered_at' => 'datetime',
            'flagged' => 'boolean',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(TestAttempt::class, 'test_attempt_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(TestQuestion::class, 'test_question_id');
    }

}
