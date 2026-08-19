<?php

namespace App\Models;

use App\Enums\AttemptStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TestAttempt extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'test_id', 'user_id', 'enrollment_id', 'attempt_number', 'status', 'started_at',
        'expires_at', 'submitted_at', 'graded_at', 'score', 'max_score', 'passed',
        'auto_submitted', 'question_order', 'submit_idempotency_key', 'ip_address',
    ];

    protected function casts(): array
    {
        return [
            'status' => AttemptStatus::class,
            'started_at' => 'datetime',
            'expires_at' => 'datetime',
            'submitted_at' => 'datetime',
            'graded_at' => 'datetime',
            'question_order' => 'array',
            'passed' => 'boolean',
            'auto_submitted' => 'boolean',
            'score' => 'decimal:2',
            'max_score' => 'decimal:2',
        ];
    }

    public function test(): BelongsTo
    {
        return $this->belongsTo(Test::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function responses(): HasMany
    {
        return $this->hasMany(TestResponse::class);
    }

    public function isInProgress(): bool
    {
        return $this->status === AttemptStatus::InProgress;
    }

    /** True once the server clock passes the stored deadline. */
    public function hasExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function secondsRemaining(): int
    {
        return max(0, now()->diffInSeconds($this->expires_at, false));
    }

    public function scopeInProgress($query)
    {
        return $query->where('status', AttemptStatus::InProgress->value);
    }
}
