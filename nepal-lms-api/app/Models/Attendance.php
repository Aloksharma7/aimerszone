<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


class Attendance extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'class_session_id',
        'user_id',
        'enrollment_id',
        'status',
        'note',
        'minutes_attended',
        'joined_at',
        'source',
        'marked_by',
        'marked_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => \App\Enums\AttendanceStatus::class,
            'joined_at' => 'datetime',
            'marked_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(ClassSession::class, 'class_session_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

}
