<?php

namespace App\Models;

use App\Enums\BatchStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Batch extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $fillable = [
        'course_id', 'title', 'code', 'public_id', 'status', 'start_at', 'end_at',
        'access_until', 'schedule_summary', 'schedule_days', 'class_start_time',
        'class_end_time', 'price_npr', 'capacity', 'zoom_meeting_id', 'zoom_join_url',
        'zoom_passcode', 'youtube_playlist_id', 'created_by',
    ];

    protected $hidden = ['zoom_join_url', 'zoom_passcode'];

    protected function casts(): array
    {
        return [
            'status' => BatchStatus::class,
            'schedule_days' => 'array',
            'start_at' => 'datetime',
            'end_at' => 'datetime',
            'access_until' => 'datetime',
            'price_npr' => 'integer',
            'capacity' => 'integer',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function teachers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'batch_teacher')->withPivot('is_lead');
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(ClassSession::class);
    }

    public function recordings(): HasMany
    {
        return $this->hasMany(Recording::class);
    }

    public function resources(): HasMany
    {
        return $this->hasMany(Resource::class);
    }

    public function tests(): HasMany
    {
        return $this->hasMany(Test::class);
    }

    /** Batches a visitor may still join. */
    public function scopeEnrollable($query)
    {
        return $query->whereIn('status', [BatchStatus::Open->value, BatchStatus::Ongoing->value]);
    }

    public function leadTeacher(): ?User
    {
        return $this->teachers->firstWhere('pivot.is_lead', true) ?? $this->teachers->first();
    }

    public function seatsRemaining(): ?int
    {
        if ($this->capacity === null) {
            return null;
        }

        return max(0, $this->capacity - $this->enrollments()->whereIn('status', ['active', 'pending'])->count());
    }

    public function isFull(): bool
    {
        $remaining = $this->seatsRemaining();

        return $remaining !== null && $remaining <= 0;
    }
}
