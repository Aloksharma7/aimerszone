<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;


class SyllabusLesson extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'syllabus_module_id',
        'title',
        'type',
        'order',
    ];

    public function module(): BelongsTo
    {
        return $this->belongsTo(SyllabusModule::class, 'syllabus_module_id');
    }

    public function completions(): HasMany
    {
        return $this->hasMany(LessonCompletion::class);
    }

    public function recordings(): HasMany
    {
        return $this->hasMany(Recording::class);
    }

    public function resources(): HasMany
    {
        return $this->hasMany(Resource::class);
    }

}
