<?php

namespace App\Models;

use App\Enums\TestStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Test extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $fillable = [
        'batch_id', 'course_id', 'title', 'instructions', 'status', 'opens_at', 'closes_at',
        'duration_minutes', 'total_marks', 'attempts_allowed', 'pass_mark', 'shuffle_questions',
        'shuffle_options', 'negative_marking', 'result_release', 'results_released_at',
        'allow_late_submission', 'created_by', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => TestStatus::class,
            'opens_at' => 'datetime',
            'closes_at' => 'datetime',
            'results_released_at' => 'datetime',
            'published_at' => 'datetime',
            'shuffle_questions' => 'boolean',
            'shuffle_options' => 'boolean',
            'allow_late_submission' => 'boolean',
            'negative_marking' => 'decimal:2',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function questions(): HasMany
    {
        return $this->hasMany(TestQuestion::class)->orderBy('order');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(TestAttempt::class);
    }

    /**
     * Server-side view of availability. The frontend renders whatever this
     * returns; it never computes open/closed itself.
     */
    public function isOpenNow(): bool
    {
        if (! in_array($this->status, [TestStatus::Open, TestStatus::Scheduled], true)) {
            return false;
        }

        $afterOpen = $this->opens_at === null || $this->opens_at->isPast();
        $beforeClose = $this->closes_at === null || $this->closes_at->isFuture();

        return $afterOpen && $beforeClose;
    }

    /** Whether a scored result may be disclosed to the student. */
    public function resultsAreReleased(): bool
    {
        return match ($this->result_release) {
            'immediate' => true,
            'after_close' => $this->closes_at !== null && $this->closes_at->isPast(),
            default => $this->results_released_at !== null && $this->results_released_at->isPast(),
        };
    }

    public function computedTotalMarks(): float
    {
        return (float) $this->questions()->sum('marks');
    }

    public function scopeVisibleToStudents($query)
    {
        return $query->whereNotIn('status', [TestStatus::Draft->value]);
    }
}
