<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Resource extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $fillable = [
        'batch_id', 'course_id', 'title', 'module_title', 'file_type', 'mime_type',
        'size_bytes', 'storage_path', 'storage_disk', 'checksum', 'released_at',
        'is_public', 'created_by',
    ];

    /* The storage key is an internal detail; downloads go through signed routes. */
    protected $hidden = ['storage_path', 'checksum'];

    protected function casts(): array
    {
        return [
            'released_at' => 'datetime',
            'is_public' => 'boolean',
            'size_bytes' => 'integer',
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

    public function downloads(): HasMany
    {
        return $this->hasMany(ResourceDownload::class);
    }

    public function scopeReleased($query)
    {
        return $query->whereNotNull('released_at')->where('released_at', '<=', now());
    }

    public function isReleased(): bool
    {
        return $this->released_at !== null && $this->released_at->isPast();
    }
}
