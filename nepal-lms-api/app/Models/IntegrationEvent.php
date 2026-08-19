<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;


class IntegrationEvent extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'provider',
        'action',
        'reference',
        'status',
        'message',
        'payload',
        'duration_ms',
        'actor_id',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'provider' => \App\Enums\IntegrationProvider::class,
            'payload' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

}
