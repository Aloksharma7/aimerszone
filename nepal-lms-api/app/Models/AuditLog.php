<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


class AuditLog extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'actor_id',
        'actor_label',
        'action',
        'target_type',
        'target_id',
        'target_label',
        'reason',
        'properties',
        'ip_address',
        'user_agent',
        'request_id',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'properties' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

}
