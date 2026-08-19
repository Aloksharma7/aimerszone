<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;


class SyllabusModule extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'course_id',
        'title',
        'summary',
        'order',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(SyllabusLesson::class);
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('order');
    }

}
