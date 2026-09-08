<?php

namespace App\Models;

use App\Enums\AttemptStatus;
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

    /**
     * Whether $userId specifically may still act on this test even though the
     * test-wide window in isOpenNow() has closed.
     *
     * allow_late_submission deliberately gives an in-progress attempt its own
     * deadline that can extend past closes_at (see AttemptController::store()),
     * so the global window closing must not by itself lock a student out of an
     * attempt they legitimately started and haven't run out of time on —
     * otherwise a reload right as the test closes strands them with whatever
     * was last autosaved, defeating the entire point of the setting.
     */
    public function hasResumableAttemptFor(string $userId): bool
    {
        if (! $this->allow_late_submission) {
            return false;
        }

        return $this->attempts()
            ->where('user_id', $userId)
            ->where('status', AttemptStatus::InProgress->value)
            ->where('expires_at', '>', now())
            ->exists();
    }

    /**
     * The status as it should currently read, not just what is stored.
     *
     * The stored column only ever holds Draft or Open — everything past
     * publishing is derived from timestamps and result_release, the same
     * way StudentTestResource::displayStatus() already computes it for a
     * student's own view. Teacher-facing reads (summary(), builder()) used
     * the raw column directly, so a test scheduled to open next week read
     * as "open" the moment it was published, and one that closed weeks ago
     * kept reading as "open" forever, because nothing ever moves the stored
     * value past that point.
     */
    public function effectiveStatus(): TestStatus
    {
        if ($this->status === TestStatus::Draft) {
            return TestStatus::Draft;
        }

        if ($this->isOpenNow()) {
            return TestStatus::Open;
        }

        if ($this->resultsAreReleased()) {
            return TestStatus::ResultReleased;
        }

        if ($this->opens_at !== null && $this->opens_at->isFuture()) {
            return TestStatus::Scheduled;
        }

        return TestStatus::Closed;
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
