<?php

namespace App\Models;

use App\Enums\ClassSessionStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ClassSession extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $fillable = [
        'batch_id', 'teacher_id', 'topic', 'description', 'status', 'starts_at', 'ends_at',
        'actual_started_at', 'actual_ended_at', 'join_opens_minutes_before', 'provider',
        'zoom_meeting_id', 'zoom_join_url', 'zoom_start_url', 'zoom_passcode',
        'zoom_sync_status', 'zoom_sync_message', 'zoom_synced_at', 'fallback_join_url',
        'fallback_note', 'fallback_active', 'rescheduled_from', 'reschedule_reason',
        'cancellation_reason', 'attendance_finalized_at', 'attendance_finalized_by', 'created_by',
        'reminder_sent_at', 'attendance_imported_at',
    ];

    /* The host URL must never reach a student payload. */
    protected $hidden = ['zoom_start_url', 'zoom_join_url', 'zoom_passcode', 'fallback_join_url'];

    protected function casts(): array
    {
        return [
            'status' => ClassSessionStatus::class,
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'actual_started_at' => 'datetime',
            'actual_ended_at' => 'datetime',
            'zoom_synced_at' => 'datetime',
            'rescheduled_from' => 'datetime',
            'attendance_finalized_at' => 'datetime',
            'reminder_sent_at' => 'datetime',
            'attendance_imported_at' => 'datetime',
            'fallback_active' => 'boolean',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class);
    }

    public function recording(): BelongsTo
    {
        return $this->belongsTo(Recording::class, 'id', 'class_session_id');
    }

    public function attendanceFinalized(): bool
    {
        return $this->attendance_finalized_at !== null;
    }

    /**
     * Students may only obtain a join destination inside this window.
     * Defaults come from admin-managed settings.
     */
    public function joinWindowIsOpen(int $minutesBefore, int $minutesAfter): bool
    {
        if (in_array($this->status, [ClassSessionStatus::Cancelled, ClassSessionStatus::Completed], true)) {
            return false;
        }

        $opensAt = $this->starts_at->copy()->subMinutes($this->join_opens_minutes_before ?? $minutesBefore);
        $closesAt = $this->ends_at->copy()->addMinutes($minutesAfter);

        return now()->betweenIncluded($opensAt, $closesAt);
    }

    public function scopeUpcoming($query)
    {
        return $query->whereIn('status', [ClassSessionStatus::Scheduled->value, ClassSessionStatus::Live->value])
            ->where('ends_at', '>=', now())
            ->orderBy('starts_at');
    }

    /**
     * The status as it should currently read, not just what is stored.
     *
     * Live only ever moves to Completed one of two ways: the teacher manually
     * finalizing attendance (which can happen hours later, or never), or the
     * scheduled lms:expire-live-classes job catching up (every 15 minutes,
     * and only if the server's cron is actually configured to run it at
     * all). Neither is guaranteed to have happened by the time a student
     * reads this — without this, a class that plainly ended kept reading
     * "Live now" indefinitely, the same way a Scheduled class the teacher
     * never started did too.
     */
    public function effectiveStatus(): ClassSessionStatus
    {
        if (in_array($this->status, [ClassSessionStatus::Live, ClassSessionStatus::Scheduled], true) && $this->ends_at->isPast()) {
            return ClassSessionStatus::Completed;
        }

        return $this->status;
    }
}
