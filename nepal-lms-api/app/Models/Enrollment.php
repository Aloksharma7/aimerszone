<?php

namespace App\Models;

use App\Enums\EnrollmentStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Enrollment extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'user_id', 'course_id', 'batch_id', 'status', 'access_start_at', 'access_end_at',
        'expiry_warned_at',
        'source', 'approved_payment_id', 'created_by', 'activated_at', 'cancelled_at',
        'cancellation_reason', 'attendance_percent', 'recording_percent', 'test_percent',
        'syllabus_percent', 'overall_percent', 'progress_calculated_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => EnrollmentStatus::class,
            'access_start_at' => 'datetime',
            'access_end_at' => 'datetime',
            'expiry_warned_at' => 'datetime',
            'activated_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'progress_calculated_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * The only state in which course content may be served.
     * Expiry is evaluated against the server clock, never the client's.
     */
    public function grantsAccess(): bool
    {
        return $this->status === EnrollmentStatus::Active
            && ($this->access_start_at === null || $this->access_start_at->isPast())
            && ($this->access_end_at === null || $this->access_end_at->isFuture());
    }

    public function scopeActive($query)
    {
        return $query->where('status', EnrollmentStatus::Active->value);
    }

    public function scopeAccessible($query)
    {
        return $query->active()->where(fn ($builder) => $builder
            ->whereNull('access_end_at')
            ->orWhere('access_end_at', '>', now()));
    }
}
