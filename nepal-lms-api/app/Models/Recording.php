<?php

namespace App\Models;

use App\Enums\RecordingState;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Recording extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $fillable = [
        'batch_id', 'class_session_id', 'title', 'module_title', 'description', 'source',
        'youtube_video_id', 'storage_path', 'storage_disk', 'external_url', 'thumbnail_url',
        'duration_seconds', 'recorded_at', 'released_at', 'state', 'sync_message', 'is_youtube_public',
        'syllabus_lesson_id', 'synced_at', 'created_by',
    ];

    protected $hidden = ['storage_path', 'external_url'];

    protected function casts(): array
    {
        return [
            'state' => RecordingState::class,
            'recorded_at' => 'datetime',
            'released_at' => 'datetime',
            'synced_at' => 'datetime',
            'duration_seconds' => 'integer',
            'is_youtube_public' => 'boolean',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(ClassSession::class, 'class_session_id');
    }

    public function syllabusLesson(): BelongsTo
    {
        return $this->belongsTo(SyllabusLesson::class);
    }

    public function progress(): HasMany
    {
        return $this->hasMany(RecordingProgress::class);
    }

    /** Released and finished processing. */
    public function scopeReleased($query)
    {
        return $query->where('state', RecordingState::Available->value)
            ->whereNotNull('released_at')
            ->where('released_at', '<=', now());
    }

    public function isReleased(): bool
    {
        return $this->state === RecordingState::Available
            && $this->released_at !== null
            && $this->released_at->isPast();
    }
}
