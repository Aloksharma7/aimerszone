<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\AccessType;
use App\Enums\EnrollmentStatus;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\EnrollmentRequest;
use App\Services\AuditLogger;
use App\Services\NotificationDispatcher;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Decides the exception requests raised by the enrollment office.
 *
 * Staff can ask for a scholarship, transfer or institutional exception, but
 * cannot grant one — that separation is the whole point of the request flow,
 * and it is what makes a free seat auditable rather than a quiet favour.
 */
class EnrollmentRequestController extends Controller
{
    public function __construct(
        protected AuditLogger $audit,
        protected SettingsRepository $settings,
        protected NotificationDispatcher $notifications,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $requests = EnrollmentRequest::query()
            ->with(['user:id,name,student_code', 'course:id,title', 'batch:id,title', 'requester:id,name'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->orderBy('created_at')
            ->paginate($this->perPage(50));

        return ApiResponse::paginated($requests, fn (EnrollmentRequest $item) => [
            'id' => $item->id,
            'student_name' => $item->user?->name ?? 'Removed account',
            'student_code' => $item->user?->student_code,
            'course_title' => $item->course?->title ?? 'Course removed',
            'batch_title' => $item->batch?->title ?? 'Batch removed',
            'basis' => $item->basis,
            'note' => $item->note,
            'requested_by' => $item->requester?->name,
            'status' => $item->status,
            'created_at' => $item->created_at->toIso8601String(),
        ]);
    }

    /** approve | reject */
    public function decide(Request $request, EnrollmentRequest $enrollmentRequest): JsonResponse
    {
        // A scholarship or institutional exception on a course that is
        // normally paid grants a full seat with nothing but a typed reason —
        // no payment record ever exists for it. That is legitimate for a
        // genuine waiver, but it is also the exact shape of a shortcut around
        // recording a real (e.g. WhatsApp-negotiated) payment, so it is
        // required here rather than optional, and it is the one enrollment
        // decision that stays exclusive to Super Admin instead of any Admin.
        // "transfer" is exempt: it moves an already-paid seat, it does not
        // create free access to one.
        $waivesAPaidFee = $enrollmentRequest->basis !== 'transfer'
            && $enrollmentRequest->course?->access_type === AccessType::Paid;

        $data = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'reason' => [
                Rule::requiredIf(fn () => $request->input('decision') === 'reject' || $waivesAPaidFee),
                'nullable', 'string', 'min:5', 'max:500',
            ],
        ]);

        if ($enrollmentRequest->status !== 'pending') {
            throw DomainException::conflict(
                'This request was already '.$enrollmentRequest->status.'.',
                'request_already_decided',
            );
        }

        if ($data['decision'] === 'approve' && $waivesAPaidFee && ! $request->user()->isSuperAdmin()) {
            throw DomainException::forbidden(
                'Waiving the fee on a paid course requires Super Admin approval. If the student actually paid, record that payment instead of granting a free seat.',
                'paid_waiver_requires_super_admin',
            );
        }

        // The officer who raised the request must not also grant it.
        if ($enrollmentRequest->requested_by === $request->user()->getKey() && ! $request->user()->isAdmin()) {
            throw DomainException::forbidden(
                'You raised this request, so it must be decided by someone else.',
                'self_decision_blocked',
            );
        }

        if ($data['decision'] === 'reject') {
            $enrollmentRequest->forceFill([
                'status' => 'rejected',
                'decided_by' => $request->user()->getKey(),
                'decided_at' => now(),
                'decision_reason' => $data['reason'],
            ])->save();

            $this->audit->log('enrollment_request.rejected', $enrollmentRequest, $request->user(), $data['reason']);

            return ApiResponse::item(['status' => 'rejected']);
        }

        $enrollment = DB::transaction(function () use ($enrollmentRequest, $request, $data) {
            $existing = Enrollment::query()
                ->where('user_id', $enrollmentRequest->user_id)
                ->where('batch_id', $enrollmentRequest->batch_id)
                ->lockForUpdate()
                ->first();

            if ($existing !== null && $existing->grantsAccess()) {
                throw DomainException::conflict(
                    'This student already holds an active seat in that batch.',
                    'already_enrolled',
                );
            }

            $accessEnd = $enrollmentRequest->batch?->access_until
                ?? now()->addDays($this->settings->int('operations.default_access_days', 180));

            // The basis is recorded on the seat itself, so a scholarship seat
            // stays distinguishable from a paid one in every later report.
            $source = $enrollmentRequest->basis === 'transfer' ? 'staff' : 'free';

            $attributes = [
                'status' => EnrollmentStatus::Active->value,
                'access_start_at' => now(),
                'access_end_at' => $accessEnd,
                'source' => $source,
                'created_by' => $request->user()->getKey(),
                'activated_at' => now(),
                'cancelled_at' => null,
                'cancellation_reason' => null,
            ];

            $enrollment = $existing !== null
                ? tap($existing)->forceFill($attributes)->save()
                : Enrollment::create($attributes + [
                    'user_id' => $enrollmentRequest->user_id,
                    'course_id' => $enrollmentRequest->course_id,
                    'batch_id' => $enrollmentRequest->batch_id,
                ]);

            $enrollmentRequest->forceFill([
                'status' => 'approved',
                'decided_by' => $request->user()->getKey(),
                'decided_at' => now(),
                'decision_reason' => $data['reason'] ?? null,
            ])->save();

            return $existing ?? $enrollment;
        });

        $this->audit->log('enrollment_request.approved', $enrollmentRequest, $request->user(), $data['reason'] ?? null, [
            'basis' => $enrollmentRequest->basis,
            'enrollment_id' => $enrollment->getKey(),
        ]);

        // Every other path that activates an enrollment tells the student;
        // this one silently left them to find out by signing in and checking.
        $this->notifications->enrollmentActivated($enrollment->load(['user', 'course']));

        return ApiResponse::item(['status' => 'approved', 'enrollment_id' => $enrollment->getKey()]);
    }
}
