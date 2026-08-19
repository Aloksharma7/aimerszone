<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Payment;
use App\Models\Receipt;
use App\Services\DashboardCache;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    use SharesPaymentPayload;

    public function __construct(protected DashboardCache $cache) {}

    public function __invoke(): JsonResponse
    {
        return ApiResponse::item($this->cache->remember(DashboardCache::ACCOUNTING, function () {
            $queue = Payment::query()
                ->pendingReview()
                ->with(['user:id,name', 'course:id,title', 'batch:id,title', 'method:id,name'])
                ->orderBy('submitted_at')
                ->limit(25)
                ->get();

            $oldest = Payment::query()->pendingReview()->min('submitted_at');

            return [
                'queue' => $queue->map(fn (Payment $payment) => $this->queuePayload($payment))->all(),
                'metrics' => [
                    'pending_review' => Payment::query()->pendingReview()->count(),
                    'oldest_pending_label' => $oldest ? now()->parse($oldest)->diffForHumans() : 'Nothing pending',
                    'approved_today' => Payment::query()->approved()->whereDate('reviewed_at', today())->count(),
                    'approved_today_amount_npr' => (int) Payment::query()->approved()->whereDate('reviewed_at', today())->sum('submitted_amount_npr'),
                    'flagged_duplicates' => Payment::query()
                        ->whereIn('risk_label', ['duplicate_evidence', 'flagged_duplicate'])
                        ->pendingReview()
                        ->count(),
                    'receipts_issued' => Receipt::query()->whereDate('issued_at', today())->count(),
                ],
                'recent_actions' => $this->recentActions(),
            ];
        }));
    }

    /** The last few money decisions, for a quick sense of what colleagues did. */
    protected function recentActions(): array
    {
        return AuditLog::query()
            ->whereIn('action', ['payment.approved', 'payment.rejected', 'payment.flagged', 'refund.recorded', 'adjustment.created'])
            ->orderByDesc('occurred_at')
            ->limit(8)
            ->get()
            ->map(fn (AuditLog $entry) => [
                'id' => $entry->id,
                'title' => match ($entry->action) {
                    'payment.approved' => 'Payment approved',
                    'payment.rejected' => 'Payment rejected',
                    'payment.flagged' => 'Payment flagged',
                    'refund.recorded' => 'Refund recorded',
                    default => 'Adjustment created',
                },
                'detail' => trim(($entry->target_label ?? '').' · '.($entry->actor_label ?? 'System'), ' ·'),
                'tone' => match ($entry->action) {
                    'payment.approved' => 'green',
                    'payment.rejected' => 'red',
                    'payment.flagged' => 'amber',
                    default => 'blue',
                },
                'type' => match ($entry->action) {
                    'payment.approved', 'payment.rejected' => 'approval',
                    'payment.flagged' => 'flag',
                    'refund.recorded' => 'refund',
                    default => 'receipt',
                },
            ])
            ->all();
    }
}
