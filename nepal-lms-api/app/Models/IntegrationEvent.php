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

    /**
     * Excludes event types that don't actually indicate whether the
     * provider connection itself is healthy:
     *
     * - health_check: its own past verdict would otherwise count as
     *   evidence against the next check, letting one bad moment keep
     *   reporting "degraded" indefinitely regardless of the real state.
     * - meeting.participants: a per-class attendance-report quirk (the
     *   report isn't ready yet, or the meeting is gone) — not a sign the
     *   connection is broken. AttendanceImportService already gives up and
     *   asks for manual entry, surfaced separately as its own
     *   "attendance register pending" item; counting it again here would
     *   just be double noise for something already handled.
     */
    public function scopeSignalsConnectionHealth($query)
    {
        return $query->whereNotIn('action', ['health_check', 'meeting.participants']);
    }
}
