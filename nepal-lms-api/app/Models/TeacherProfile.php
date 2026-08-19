<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


class TeacherProfile extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'user_id',
        'slug',
        'headline',
        'subjects',
        'experience_summary',
        'bio',
        'avatar_path',
        'is_public',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'subjects' => 'array',
            'is_public' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopePublic($query)
    {
        return $query->where('is_public', true);
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
