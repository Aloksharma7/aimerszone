<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;


class IdempotencyKey extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'key',
        'user_id',
        'endpoint',
        'request_hash',
        'status',
        'response_code',
        'response_body',
        'locked_at',
        'completed_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'locked_at' => 'datetime',
            'completed_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

}
