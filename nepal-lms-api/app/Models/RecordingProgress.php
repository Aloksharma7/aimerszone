<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


class RecordingProgress extends Model
{
    use HasFactory, HasUlids;

    protected $table = 'recording_progress';

    protected $fillable = [
        'recording_id',
        'user_id',
        'progress_percent',
        'last_position_seconds',
        'last_watched_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'last_watched_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function recording(): BelongsTo
    {
        return $this->belongsTo(Recording::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

}
