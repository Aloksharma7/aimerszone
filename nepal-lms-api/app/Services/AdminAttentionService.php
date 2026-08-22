<?php

namespace App\Services;

use App\Enums\BatchStatus;
use App\Enums\IntegrationProvider;
use App\Models\Batch;
use App\Models\ClassSession;
use App\Models\IntegrationEvent;
use App\Models\Payment;

/**
 * Items that need a human decision today, for the admin dashboard's
 * "attention" panel and the admin notification bell — the same signals,
 * shown two ways. Only non-zero signals are returned, so both stay empty
 * when nothing is wrong.
 */
class AdminAttentionService
{
    public function items(): array
    {
        $items = [];

        $pending = Payment::query()->pendingReview()->count();

        if ($pending > 0) {
            $oldest = Payment::query()->pendingReview()->min('submitted_at');

            $items[] = [
                'id' => 'payment-pending',
                'title' => $pending.' payment'.($pending === 1 ? '' : 's').' pending',
                'detail' => $oldest
                    ? 'Oldest submission '.now()->parse($oldest)->diffForHumans()
                    : 'Awaiting accounting review',
                'href' => '/admin/payments?status=pending',
                'tone' => 'amber',
            ];
        }

        // A finished class whose register was never finalized blocks attendance
        // reporting and the student's progress figure.
        $attendance = ClassSession::query()
            ->where('ends_at', '<', now())
            ->whereNull('attendance_finalized_at')
            ->whereNotIn('status', ['cancelled'])
            ->count();

        if ($attendance > 0) {
            $items[] = [
                'id' => 'attendance-pending',
                'title' => $attendance.' attendance register'.($attendance === 1 ? '' : 's').' pending',
                'detail' => 'Teacher finalization required',
                'href' => '/admin/attendance',
                'tone' => 'blue',
            ];
        }

        $zoomFailures = IntegrationEvent::query()
            ->where('provider', IntegrationProvider::Zoom->value)
            ->where('status', 'failed')
            ->where('occurred_at', '>=', now()->subDay())
            ->count();

        if ($zoomFailures > 0) {
            $items[] = [
                'id' => 'zoom-warning',
                'title' => $zoomFailures.' Zoom sync warning'.($zoomFailures === 1 ? '' : 's'),
                'detail' => 'Manual fallback available',
                'href' => '/admin/integrations/zoom',
                'tone' => 'red',
            ];
        }

        $drafts = Batch::query()->where('status', BatchStatus::Draft->value)->count();

        if ($drafts > 0) {
            $items[] = [
                'id' => 'draft-batches',
                'title' => $drafts.' draft batch'.($drafts === 1 ? '' : 'es'),
                'detail' => 'Missing launch information',
                'href' => '/admin/batches',
                'tone' => 'violet',
            ];
        }

        return $items;
    }
}
