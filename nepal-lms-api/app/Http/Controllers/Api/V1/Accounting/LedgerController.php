<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Enums\AdjustmentType;
use App\Enums\EnrollmentStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\LedgerAdjustment;
use App\Models\Payment;
use App\Models\Receipt;
use App\Models\Refund;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\MediaLinkService;
use App\Services\NotificationDispatcher;
use App\Support\ApiResponse;
use App\Support\CsvStream;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Receipts, adjustments and refunds.
 *
 * Nothing here edits an approved payment. A correction is always a new signed
 * ledger row referencing the original, so the money trail stays append-only and
 * an auditor can reconstruct what happened.
 */
class LedgerController extends Controller
{
    public function __construct(
        protected MediaLinkService $links,
        protected AuditLogger $audit,
        protected NotificationDispatcher $notifications,
    ) {}

    /* ---------------------------- Receipts ---------------------------- */

    public function receipts(Request $request): JsonResponse
    {
        $receipts = Receipt::query()
            ->with(['payment.user:id,name', 'payment.course:id,title'])
            ->orderByDesc('issued_at')
            ->limit($this->perPage(100))
            ->get();

        return ApiResponse::item([
            'items' => $receipts->map(fn (Receipt $receipt) => [
                'id' => $receipt->id,
                'payment_id' => $receipt->payment_id,
                'student_name' => $receipt->snapshot['student_name'] ?? $receipt->payment?->user?->name ?? '',
                'course_title' => $receipt->snapshot['course_title'] ?? $receipt->payment?->course?->title ?? '',
                'amount_npr' => (int) $receipt->amount_npr,
                'issued_at' => $receipt->issued_at->toIso8601String(),
                'status' => 'issued',
            ])->all(),
            'metrics' => [
                'today' => Receipt::whereDate('issued_at', today())->count(),
                'month' => Receipt::where('issued_at', '>=', now()->startOfMonth())->count(),
                'adjusted' => LedgerAdjustment::where('created_at', '>=', now()->startOfMonth())->count(),
            ],
        ]);
    }

    public function exportReceipts(Request $request): StreamedResponse
    {
        $this->audit->log('export.generated', actor: $request->user(), properties: ['dataset' => 'receipts'], targetLabel: 'Export: receipts');

        $query = Receipt::query()
            ->when($request->filled('from'), fn ($builder) => $builder->where('issued_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($builder) => $builder->where('issued_at', '<=', $request->date('to')))
            ->orderByDesc('issued_at');

        return CsvStream::fromQuery(
            $query,
            ['Receipt', 'Payment', 'Student', 'Student code', 'Course', 'Batch', 'Method', 'Amount', 'Issued'],
            fn (Receipt $receipt) => [
                $receipt->number,
                $receipt->payment_id,
                $receipt->snapshot['student_name'] ?? '',
                $receipt->snapshot['student_code'] ?? '',
                $receipt->snapshot['course_title'] ?? '',
                $receipt->snapshot['batch_title'] ?? '',
                $receipt->snapshot['payment_method'] ?? '',
                $receipt->amount_npr,
                $receipt->issued_at,
            ],
            'receipts-'.now()->format('Y-m-d').'.csv',
        );
    }

    /* --------------------------- Adjustments -------------------------- */

    public function adjustments(Request $request): JsonResponse
    {
        $adjustments = LedgerAdjustment::query()
            ->with(['user:id,name'])
            ->orderByDesc('created_at')
            ->limit($this->perPage(100))
            ->get();

        return ApiResponse::item([
            'items' => $adjustments->map(fn (LedgerAdjustment $adjustment) => [
                'id' => $adjustment->id,
                'payment_id' => $adjustment->payment_id ?? '',
                'student_name' => $adjustment->user?->name ?? '',
                'type' => $adjustment->type->value,
                'amount_npr' => (int) $adjustment->amount_npr,
                'reason' => $adjustment->reason,
                'created_at' => $adjustment->created_at->toIso8601String(),
                'status' => 'recorded',
            ])->all(),
            'metrics' => [
                'pending' => Refund::where('status', 'requested')->count(),
                'completed_month' => Refund::where('status', 'processed')
                    ->where('processed_at', '>=', now()->startOfMonth())
                    ->count(),
                'refunded_month_npr' => (int) Refund::where('status', 'processed')
                    ->where('processed_at', '>=', now()->startOfMonth())
                    ->sum('amount_npr'),
            ],
        ]);
    }

    public function storeAdjustment(Request $request): JsonResponse
    {
        $this->authorize('adjust', Payment::class);

        $data = $request->validate([
            'payment_id' => ['required', 'string'],
            'type' => ['required', 'string', 'max:30'],
            'amount_npr' => ['required', 'integer', 'min:1', 'max:10000000'],
            'reason' => ['required', 'string', 'min:10', 'max:500'],

            // An adjustment without an approval reference is not auditable.
            'authorization_reference' => ['required', 'string', 'min:3', 'max:120'],
        ]);

        $type = $this->normalizeType($data['type']);
        $isCredit = in_array($type, [AdjustmentType::Discount, AdjustmentType::Waiver], true);

        $adjustment = DB::transaction(function () use ($data, $type, $isCredit, $request) {
            // Locked and re-validated here, the same as refunds: state can
            // change between page load and click, and this is where the
            // decision is actually serialized.
            $payment = Payment::whereKey($data['payment_id'])->lockForUpdate()->firstOrFail();

            if ($payment->status !== PaymentStatus::Approved) {
                throw DomainException::conflict(
                    'Only an approved payment can be adjusted.',
                    'payment_not_approved',
                );
            }

            // Credits to the student are stored negative so the ledger sums
            // cleanly. A discount/waiver can only reduce what was actually
            // paid, never past zero — previously nothing stopped posting a
            // waiver far larger than the payment itself, or the same waiver
            // repeated indefinitely against one payment.
            $signed = $isCredit ? -abs($data['amount_npr']) : abs($data['amount_npr']);

            if ($isCredit) {
                $existingCredits = (int) LedgerAdjustment::where('payment_id', $payment->getKey())
                    ->where('amount_npr', '<', 0)
                    ->sum('amount_npr');

                if (abs($existingCredits) + abs($signed) > $payment->submitted_amount_npr) {
                    throw DomainException::conflict(
                        'This would discount or waive more than was actually paid.',
                        'adjustment_exceeds_payment',
                    );
                }
            }

            return LedgerAdjustment::create([
                'user_id' => $payment->user_id,
                'enrollment_id' => $payment->enrollment_id,
                'payment_id' => $payment->getKey(),
                'type' => $type->value,
                'amount_npr' => $signed,
                'reason' => $data['reason'],
                'reference' => $data['authorization_reference'],
                'effective_at' => now(),
                'created_by' => $request->user()->getKey(),
            ]);
        });

        $this->audit->log('adjustment.created', $adjustment, $request->user(), $data['reason'], [
            'payment_id' => $adjustment->payment_id,
            'amount' => $adjustment->amount_npr,
            'authorization' => $data['authorization_reference'],
        ]);

        return ApiResponse::item(['id' => $adjustment->id], status: 201);
    }

    /* ----------------------------- Refunds ---------------------------- */

    public function refunds(Request $request): JsonResponse
    {
        $refunds = Refund::query()
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->limit($this->perPage(100))
            ->get();

        return ApiResponse::item([
            'items' => $refunds->map(fn (Refund $refund) => [
                'id' => $refund->id,
                'payment_id' => $refund->payment_id,
                'student_name' => $refund->user?->name ?? '',
                'amount_npr' => (int) $refund->amount_npr,
                'reason' => $refund->reason,
                'requested_at' => $refund->created_at->toIso8601String(),
                'status' => $refund->status,
            ])->all(),
            'metrics' => [
                'pending' => Refund::where('status', 'requested')->count(),
                'completed_month' => Refund::where('status', 'processed')
                    ->where('processed_at', '>=', now()->startOfMonth())
                    ->count(),
                'completed_amount_npr' => (int) Refund::where('status', 'processed')
                    ->where('processed_at', '>=', now()->startOfMonth())
                    ->sum('amount_npr'),

                // Refunds that were requested but never reached a payout.
                'exceptions' => Refund::where('status', 'requested')
                    ->where('created_at', '<', now()->subDays(7))
                    ->count(),
            ],
        ]);
    }

    public function storeRefund(Request $request): JsonResponse
    {
        $this->authorize('refund', Payment::class);

        $data = $request->validate([
            'payment_id' => ['required', 'string'],
            'amount_npr' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'min:10', 'max:500'],
            'method' => ['nullable', 'string', 'max:40'],
            'reference' => ['nullable', 'string', 'max:120'],
        ]);

        $refund = DB::transaction(function () use ($data, $request) {
            $payment = Payment::whereKey($data['payment_id'])->lockForUpdate()->firstOrFail();

            if ($payment->status !== PaymentStatus::Approved) {
                throw DomainException::conflict(
                    'Only an approved payment can be refunded.',
                    'payment_not_approved',
                );
            }

            $alreadyRefunded = (int) Refund::where('payment_id', $payment->getKey())
                ->whereIn('status', ['requested', 'processed'])
                ->sum('amount_npr');

            if ($alreadyRefunded + $data['amount_npr'] > $payment->submitted_amount_npr) {
                throw DomainException::conflict(
                    'This would refund more than was actually paid.',
                    'refund_exceeds_payment',
                );
            }

            return Refund::create([
                'payment_id' => $payment->getKey(),
                'user_id' => $payment->user_id,
                'amount_npr' => $data['amount_npr'],
                'status' => 'requested',
                'reason' => $data['reason'],
                'method' => $data['method'] ?? null,
                'reference' => $data['reference'] ?? null,
                'requested_by' => $request->user()->getKey(),
            ]);
        });

        $this->audit->log('refund.recorded', $refund, $request->user(), $data['reason'], [
            'amount' => $data['amount_npr'],
        ]);

        return ApiResponse::item(['id' => $refund->id, 'status' => $refund->status], status: 201);
    }

    /**
     * Marks a requested refund as actually paid out.
     *
     * Without this step a refund stays at "requested" forever and never reaches
     * the collections report, which only counts processed refunds.
     */
    public function completeRefund(Request $request, Refund $refund): JsonResponse
    {
        $this->authorize('refund', Payment::class);

        $data = $request->validate([
            'reference' => ['nullable', 'string', 'max:120'],
            'method' => ['nullable', 'string', 'max:40'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        if ($refund->status !== 'requested') {
            throw DomainException::conflict(
                'This refund is already '.$refund->status.'.',
                'refund_not_pending',
            );
        }

        // Separation of duties: the person who requested the refund should not
        // also be the one recording that the money left the account.
        if ($refund->requested_by === $request->user()->getKey() && ! $request->user()->isAdmin()) {
            throw DomainException::forbidden(
                'You requested this refund, so it must be completed by someone else.',
                'self_completion_blocked',
            );
        }

        $refund->forceFill([
            'status' => 'processed',
            'processed_at' => now(),
            'approved_by' => $request->user()->getKey(),
            'reference' => $data['reference'] ?? $refund->reference,
            'method' => $data['method'] ?? $refund->method,
        ])->save();

        $this->audit->log('refund.processed', $refund, $request->user(), $data['note'] ?? null, [
            'amount' => $refund->amount_npr,
        ]);

        $this->revokeAccessIfFullyRefunded($refund, $request->user());

        return ApiResponse::item(['status' => $refund->status]);
    }

    /**
     * Closes the seat a payment paid for once it has been refunded in full.
     *
     * Processing a refund used to touch only the Refund row — the payment's
     * enrollment stayed Active with its original access_end_at untouched, so a
     * fully refunded student kept live classes, recordings, tests and
     * resources for the rest of the access window the refunded money was
     * supposed to have ended. A partial refund (a goodwill gesture, a pricing
     * correction) deliberately does not touch access — only a refund that
     * reaches the full paid amount does.
     */
    protected function revokeAccessIfFullyRefunded(Refund $refund, User $reviewer): void
    {
        $payment = $refund->payment;

        if ($payment === null || $payment->enrollment_id === null) {
            return;
        }

        $totalRefunded = (int) Refund::where('payment_id', $payment->getKey())
            ->where('status', 'processed')
            ->sum('amount_npr');

        if ($totalRefunded < $payment->submitted_amount_npr) {
            return;
        }

        DB::transaction(function () use ($payment, $reviewer) {
            $enrollment = Enrollment::whereKey($payment->enrollment_id)->lockForUpdate()->first();

            if ($enrollment === null || $enrollment->status !== EnrollmentStatus::Active) {
                return;
            }

            $enrollment->forceFill([
                'status' => EnrollmentStatus::Cancelled->value,
                'access_end_at' => now(),
                'cancelled_at' => now(),
                'cancellation_reason' => 'Payment fully refunded',
            ])->save();

            $this->audit->log('enrollment.revoked_by_refund', $enrollment, $reviewer, 'Payment fully refunded', [
                'payment_id' => $payment->getKey(),
            ]);

            DB::afterCommit(function () use ($enrollment) {
                $this->notifications->enrollmentRevoked($enrollment->fresh()->load(['user', 'course']));
            });
        });
    }

    protected function normalizeType(string $value): AdjustmentType
    {
        return match (strtolower($value)) {
            'discount' => AdjustmentType::Discount,
            'waiver', 'credit' => AdjustmentType::Waiver,
            'penalty', 'debit' => AdjustmentType::Penalty,
            default => AdjustmentType::Correction,
        };
    }
}
