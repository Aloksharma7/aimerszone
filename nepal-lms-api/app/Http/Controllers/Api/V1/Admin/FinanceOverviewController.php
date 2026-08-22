<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Refund;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * Money at a glance for the administrator.
 *
 * The queue is intentionally read-only here; approving and rejecting lives in
 * the accounting portal so that separation of duties stays visible in the URL.
 */
class FinanceOverviewController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $queue = Payment::query()
            ->pendingReview()
            ->with(['user:id,name', 'course:id,title', 'method:id,name'])
            ->orderBy('submitted_at')
            ->limit(25)
            ->get();

        return ApiResponse::item([
            'queue' => $queue->map(fn (Payment $payment) => [
                'id' => $payment->id,
                'student' => $payment->user?->name ?? 'Removed account',
                'course' => $payment->course?->title ?? 'Course removed',
                'amount' => (int) $payment->submitted_amount_npr,
                'method' => $payment->method?->name ?? 'Not recorded',
                'submitted' => $payment->submitted_at?->toIso8601String() ?? '',
                'risk' => $this->riskLabel($payment),
                'status' => $payment->status->value,
            ])->all(),
            'metrics' => [
                'pending' => Payment::query()->pendingReview()->count(),
                'approved_today' => Payment::query()->approved()->whereDate('reviewed_at', today())->count(),
                'approved_today_npr' => (int) Payment::query()->approved()->whereDate('reviewed_at', today())->sum('submitted_amount_npr'),
                'month_npr' => (int) Payment::query()->approved()->where('reviewed_at', '>=', now()->startOfMonth())->sum('submitted_amount_npr'),
                'refunds_month_npr' => (int) Refund::query()
                    ->where('status', 'processed')
                    ->where('processed_at', '>=', now()->startOfMonth())
                    ->sum('amount_npr'),
            ],
        ]);
    }

    protected function riskLabel(Payment $payment): string
    {
        return match ($payment->risk_label) {
            'duplicate_evidence' => 'Duplicate evidence',
            'short_payment' => 'Short payment',
            'full_waiver' => 'Full waiver',
            'overpayment' => 'Overpayment',
            default => 'Standard',
        };
    }
}
