<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Http\Requests\Student\SubmitPaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Http\Resources\PublicPaymentMethodResource;
use App\Models\Batch;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Services\AuditLogger;
use App\Services\MediaLinkService;
use App\Services\PaymentSubmissionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(
        protected PaymentSubmissionService $submissions,
        protected MediaLinkService $links,
        protected AuditLogger $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $payments = Payment::query()
            ->where('user_id', $request->user()->getKey())
            ->with(['course:id,title', 'batch:id,title', 'method:id,name', 'receipt:id,payment_id'])
            ->orderByDesc('submitted_at')
            ->paginate($this->perPage(20));

        return ApiResponse::paginated($payments, fn (Payment $payment) => (new PaymentResource($payment))->toArray($request));
    }

    /**
     * What the student needs to complete a payment for one batch: the amount
     * the server expects, and the accounts the administrator has published.
     */
    public function options(Request $request): JsonResponse
    {
        $request->validate(['batch_id' => ['required', 'string']]);

        $batch = Batch::with('course')->findOrFail($request->string('batch_id')->value());

        return ApiResponse::item([
            'batch_id' => $batch->id,
            'batch_title' => $batch->title,
            'course_title' => $batch->course?->title,

            // The client never decides the price.
            'expected_amount_npr' => (int) ($batch->price_npr ?: $batch->course?->price_npr ?? 0),

            'seats_remaining' => $batch->seatsRemaining(),
            'already_enrolled' => $request->user()->enrollments()->where('batch_id', $batch->getKey())->accessible()->exists(),
            'pending_review' => $request->user()->payments()->where('batch_id', $batch->getKey())->pendingReview()->exists(),
            'methods' => PublicPaymentMethodResource::collection(PaymentMethod::active()->get())->resolve(),
        ]);
    }

    public function store(SubmitPaymentRequest $request): JsonResponse
    {
        $payment = $this->submissions->submit(
            $request->user(),
            $request->validated(),
            $request->file('proof_file'),
        );

        $payment->load(['course:id,title', 'batch:id,title', 'method:id,name']);

        return ApiResponse::item(new PaymentResource($payment), status: 201);
    }

    /**
     * Short-lived, authorized link to the student's own evidence file —
     * PaymentPolicy already allowed this (payment.user_id === user.id), but
     * no route existed to reach it, so a student could never actually view
     * what they themselves uploaded. Mirrors Accounting\PaymentController::proof().
     */
    public function proof(Request $request, Payment $payment): JsonResponse
    {
        $this->authorize('viewProof', $payment);

        abort_unless($payment->hasProof(), 404);

        $this->audit->log('payment.proof_viewed', $payment, $request->user());

        $destination = $this->links->forPaymentProof($payment);

        return ApiResponse::destination($destination['url'], $destination['expires_at']);
    }
}
