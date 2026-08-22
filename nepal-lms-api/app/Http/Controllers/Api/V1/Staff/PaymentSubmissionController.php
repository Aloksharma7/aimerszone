<?php

namespace App\Http\Controllers\Api\V1\Staff;

use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\MediaLinkService;
use App\Services\PaymentDecisionService;
use App\Services\PaymentSubmissionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Payment evidence captured at the counter on a student's behalf.
 *
 * Submitting never grants access. The record enters the same accounting queue
 * as a student's own submission, and the submitting officer is barred from
 * approving it.
 */
class PaymentSubmissionController extends Controller
{
    public function __construct(
        protected PaymentSubmissionService $submissions,
        protected PaymentDecisionService $decisions,
        protected MediaLinkService $links,
        protected AuditLogger $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $payments = Payment::query()
            ->with(['user:id,name', 'course:id,title', 'batch:id,title', 'method:id,name'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->orderByDesc('submitted_at')
            ->paginate($this->perPage(100));

        return ApiResponse::paginated($payments, fn (Payment $payment) => $this->payload($payment));
    }

    public function show(Request $request, Payment $payment): JsonResponse
    {
        $this->authorize('view', $payment);

        $payment->load(['user:id,name', 'course:id,title', 'batch:id,title', 'method:id,name']);

        return ApiResponse::item($this->payload($payment));
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('submit', Payment::class);

        $data = $request->validate([
            'student_id' => ['required', 'string'],
            'course_id' => ['required', 'string'],
            'batch_id' => ['nullable', 'string'],
            'payment_method' => ['required', 'string', 'max:40'],

            // 0 is a real value here, not a missing one: a full scholarship or
            // fee waiver is recorded as a genuine zero-amount submission (proof
            // is the institution's authorization slip), not a fake amount that
            // would misstate collections. It still gets flagged and routed to a
            // second reviewer — see PaymentSubmissionService::riskLabel().
            'amount_npr' => ['required', 'numeric', 'min:0', 'max:10000000'],
            'payer_name' => ['required', 'string', 'min:2', 'max:120'],
            'transaction_reference' => ['nullable', 'string', 'max:120'],
            'payment_date' => ['required', 'date', 'before_or_equal:now'],
            'internal_note' => ['nullable', 'string', 'max:500'],
            'status' => ['required', Rule::in(['draft', 'submitted'])],
            'proof' => [
                Rule::requiredIf(fn () => $request->input('status') === 'submitted'),
                'file',
                'mimes:'.implode(',', (array) config('lms.uploads.proof_mimes')),
                'max:'.(int) config('lms.uploads.proof_max_kb'),
            ],
        ]);

        $student = User::findOrFail($data['student_id']);

        $batch = filled($data['batch_id'] ?? null)
            ? Batch::where('id', $data['batch_id'])->where('course_id', $data['course_id'])->firstOrFail()
            : Batch::where('course_id', $data['course_id'])->enrollable()->orderBy('start_at')->firstOrFail();

        $method = PaymentMethod::where('key', $data['payment_method'])
            ->orWhere('id', $data['payment_method'])
            ->firstOrFail();

        $payment = $this->submissions->submit(
            $student,
            [
                'batch_id' => $batch->getKey(),
                'payment_method_id' => $method->getKey(),
                'amount_npr' => (int) $data['amount_npr'],
                'payer_name' => $data['payer_name'],
                'transaction_reference' => $data['transaction_reference'] ?? null,
                'paid_at' => $data['payment_date'],
                'note' => $data['internal_note'] ?? null,
            ],
            $request->file('proof'),
            $request->user(),
        );

        // A draft is an incomplete capture parked for later; it must not appear
        // in the accountant's review queue.
        if ($data['status'] === 'draft') {
            $payment->forceFill(['status' => PaymentStatus::Draft->value, 'submitted_at' => null])->save();
        } elseif ($payment->risk_label === null) {
            // The staff member already verified this evidence in person
            // before capturing it here — see PaymentDecisionService for why
            // that makes the usual second reviewer unnecessary. A flagged
            // submission (duplicate evidence, short or over payment) still
            // falls through to the normal review queue below.
            $payment = $this->decisions->approveStaffCapturedPayment(
                $payment,
                $request->user(),
                'Enrolled directly by staff; payment evidence verified at the time of capture.',
            );
        }

        return ApiResponse::item(['id' => $payment->id, 'status' => $payment->fresh()->status->value], status: 201);
    }

    public function proof(Request $request, Payment $payment): JsonResponse
    {
        $this->authorize('viewProof', $payment);

        abort_unless($payment->hasProof(), 404);

        $destination = $this->links->forPaymentProof($payment);

        return ApiResponse::destination($destination['url'], $destination['expires_at']);
    }

    /** Records that the student was chased about a rejected or pending payment. */
    public function notify(Request $request, Payment $payment): JsonResponse
    {
        $this->authorize('view', $payment);

        $request->validate(['note' => ['nullable', 'string', 'max:500']]);

        $this->audit->log('payment.student_notified', $payment, $request->user(), $request->string('note')->value() ?: null);

        return ApiResponse::item(['notified' => true]);
    }

    protected function payload(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'student_name' => $payment->user?->name,
            'status' => $payment->status->value,
            'expected_amount_npr' => (int) $payment->expected_amount_npr,
            'submitted_amount_npr' => (int) $payment->submitted_amount_npr,
            'payment_method' => $payment->method?->name ?? 'Not recorded',
            'transaction_reference' => $payment->transaction_reference,
            'submitted_at' => $payment->submitted_at?->toIso8601String(),
            'rejection_reason' => $payment->rejection_reason,
            'proof_preview_available' => $payment->hasProof(),
            'course_title' => $payment->course?->title,
            'batch_title' => $payment->batch?->title,
            'risk_label' => $this->riskLabel($payment),
        ];
    }

    protected function riskLabel(Payment $payment): string
    {
        return match ($payment->risk_label) {
            'duplicate_evidence' => 'Duplicate evidence',
            'short_payment' => 'Short payment',
            'full_waiver' => 'Full waiver',
            'overpayment' => 'Overpayment',
            'flagged_duplicate' => 'Flagged',
            default => 'Normal',
        };
    }
}
