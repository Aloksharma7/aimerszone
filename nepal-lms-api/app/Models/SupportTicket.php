<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;


class SupportTicket extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'reference',
        'user_id',
        'enrollment_id',
        'name',
        'email',
        'mobile',
        'subject',
        'category',
        'message',
        'status',
        'priority',
        'source',
        'assigned_to',
        'resolved_at',
        'resolution_note',
        'ip_address',
    ];

    protected function casts(): array
    {
        return [
            'status' => \App\Enums\SupportTicketStatus::class,
            'resolved_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportTicketMessage::class);
    }

}
