<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Services\AuditLogger;
use App\Services\MediaLinkService;
use App\Services\PaymentDecisionService;
use App\Support\ApiResponse;
use App\Support\CsvStream;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The accountant's review queue and the decision endpoint.
 *
 * Approval is the only path by which a paid enrollment becomes active, and it
 * runs as one transaction in PaymentDecisionService.
 */
class PaymentController extends Controller
{
    use SharesPaymentPayload;

    public function __construct(
        protected PaymentDecisionService $decisions,
        protected MediaLinkService $links,
        protected AuditLogger $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $payments = Payment::query()
            ->with(['user:id,name', 'course:id,title', 'batch:id,title', 'method:id,name'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->when($request->filled('q'), fn ($query) => $query->whereHas(
                'user',
                fn ($builder) => $builder->search($request->string('q')->value()),
            ))
            ->orderByDesc('submitted_at')
            ->paginate($this->perPage(100));

        return ApiResponse::paginated($payments, fn (Payment $payment) => $this->queuePayload($payment));
    }

    /** Everything the accountant needs to decide, on one screen. */
    public function show(Request $request, Payment $payment): JsonResponse
    {
        $this->authorize('view', $payment);

        $payment->load(['user:id,name,mobile,student_code', 'course:id,title', 'batch:id,title', 'method:id,name', 'reviewer:id,name']);

        $existing = Enrollment::query()
            ->where('user_id', $payment->user_id)
            ->where('batch_id', $payment->batch_id)
            ->first();

        return ApiResponse::item([
            'id' => $payment->id,
            'status' => $payment->status->value,
            'submitted_at' => $payment->submitted_at?->toIso8601String() ?? '',
            'submitted_by_name' => $payment->submitted_by === $payment->user_id
                ? ($payment->user?->name.' (student)')
                : \App\Models\User::find($payment->submitted_by)?->name,
            'student' => [
                'id' => $payment->user_id,
                'student_code' => $payment->user?->student_code,
                'name' => $payment->user?->name ?? 'Removed account',
                'mobile' => $payment->user?->mobile,
            ],
            'course_title' => $payment->course?->title ?? 'Course removed',
            'batch_title' => $payment->batch?->title ?? 'Batch removed',
            'expected_amount_npr' => (int) $payment->expected_amount_npr,
            'submitted_amount_npr' => (int) $payment->submitted_amount_npr,
            'payment_method' => $payment->method?->name ?? 'Not recorded',
            'transaction_reference' => $payment->transaction_reference,
            'paid_at' => $payment->paid_at?->toIso8601String(),
            'existing_enrollment_label' => $existing
                ? ucfirst($existing->status->value).' seat already on record'
                : 'No existing enrollment',
            'proof' => [
                'original_name' => $payment->hasProof() ? 'payment-evidence' : null,
                'mime_type' => $payment->proof_mime,
                'size_label' => $this->humanSize($payment->proof_size),
                'available' => $payment->hasProof(),
            ],
            'duplicate_check' => $this->duplicateCheck($payment),
        ]);
    }

    /** Short-lived, authorized link to the evidence file. */
    public function proof(Request $request, Payment $payment): JsonResponse
    {
        $this->authorize('viewProof', $payment);

        abort_unless($payment->hasProof(), 404);

        $this->audit->log('payment.proof_viewed', $payment, $request->user());

        $destination = $this->links->forPaymentProof($payment);

        return ApiResponse::destination($destination['url'], $destination['expires_at']);
    }

    /** approve | reject | flag */
    public function decide(Request $request, Payment $payment): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject', 'flag'])],

            // Approving may be wordless; refusing or pausing must be explained,
            // because the student is shown the reason.
            'reason' => [Rule::requiredIf(fn () => $request->input('decision') !== 'approve'), 'nullable', 'string', 'min:5', 'max:500'],
        ]);

        $this->authorize('review', $payment);

        $reviewer = $request->user();
        $reason = $data['reason'] ?? null;

        $result = match ($data['decision']) {
            'approve' => $this->decisions->approve($payment, $reviewer, $reason),
            'reject' => $this->decisions->reject($payment, $reviewer, $reason),
            'flag' => $this->decisions->flag($payment, $reviewer, $reason),
        };

        return ApiResponse::item([
            'status' => $result->status->value,
            'message' => match ($data['decision']) {
                'approve' => 'Payment approved. The enrollment is active and a receipt has been issued.',
                'reject' => 'Payment rejected. The student can see the reason and resubmit.',
                default => 'Payment flagged for duplicate review. It remains in the queue.',
            },
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $this->audit->log('export.generated', actor: $request->user(), properties: ['dataset' => 'payments'], targetLabel: 'Export: payments');

        $query = Payment::query()
            ->with(['user:id,name,student_code', 'course:id,title', 'method:id,name'])
            ->when($request->filled('status'), fn ($builder) => $builder->where('status', $request->string('status')->value()))
            ->when($request->filled('from'), fn ($builder) => $builder->where('submitted_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($builder) => $builder->where('submitted_at', '<=', $request->date('to')))
            ->orderByDesc('submitted_at');

        return CsvStream::fromQuery(
            $query,
            ['Payment', 'Student code', 'Student', 'Course', 'Method', 'Expected', 'Paid', 'Reference', 'Status', 'Submitted', 'Reviewed'],
            fn (Payment $payment) => [
                $payment->id,
                $payment->user?->student_code,
                $payment->user?->name,
                $payment->course?->title,
                $payment->method?->name,
                $payment->expected_amount_npr,
                $payment->submitted_amount_npr,
                $payment->transaction_reference,
                $payment->status->value,
                $payment->submitted_at,
                $payment->reviewed_at,
            ],
            'payments-'.now()->format('Y-m-d').'.csv',
        );
    }

    /**
     * Two independent signals: the same evidence file uploaded twice, and the
     * same transaction reference claimed twice.
     */
    protected function duplicateCheck(Payment $payment): array
    {
        $sameFile = filled($payment->proof_hash)
            ? Payment::where('proof_hash', $payment->proof_hash)->whereKeyNot($payment->getKey())->count()
            : 0;

        $sameReference = filled($payment->transaction_reference)
            ? Payment::where('transaction_reference', $payment->transaction_reference)->whereKeyNot($payment->getKey())->count()
            : 0;

        if ($sameFile > 0) {
            return [
                'state' => 'duplicate',
                'message' => 'This exact evidence file was already submitted '.$sameFile.' other time(s).',
            ];
        }

        if ($sameReference > 0) {
            return [
                'state' => 'warning',
                'message' => 'This transaction reference appears on '.$sameReference.' other payment(s).',
            ];
        }

        if ($payment->submitted_amount_npr !== $payment->expected_amount_npr) {
            return [
                'state' => 'warning',
                'message' => 'The amount paid does not match the expected amount.',
            ];
        }

        return ['state' => 'clear', 'message' => 'No duplicate evidence or reference found.'];
    }
}
