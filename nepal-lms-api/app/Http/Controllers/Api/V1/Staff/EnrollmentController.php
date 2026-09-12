<?php

namespace App\Http\Controllers\Api\V1\Staff;

use App\Enums\EnrollmentStatus;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use App\Support\CsvStream;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EnrollmentController extends Controller
{
    public function __construct(protected AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        $enrollments = Enrollment::query()
            ->with(['user:id,name', 'course:id,title', 'batch:id,title'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->when($request->filled('batch_id'), fn ($query) => $query->where('batch_id', $request->string('batch_id')->value()))
            ->orderByDesc('created_at')
            ->paginate($this->perPage(100));

        return ApiResponse::paginated($enrollments, fn (Enrollment $enrollment) => $this->payload($enrollment));
    }

    /**
     * Full detail for one seat — there was previously no way to open a
     * single enrolment at all, only the roster list.
     */
    public function show(Enrollment $enrollment): JsonResponse
    {
        $enrollment->load(['user:id,name,mobile,email,student_code', 'course:id,title', 'batch:id,title,status']);

        return ApiResponse::item($this->detailPayload($enrollment));
    }

    /**
     * Cancels a seat: revokes access immediately and records why, but keeps
     * the row — payments, attendance and progress all stay attributable to
     * it. This is the everyday "remove this enrolment" action; a true
     * permanent delete lives in destroy() for the rare case that never
     * should have existed at all.
     */
    public function cancel(Request $request, Enrollment $enrollment): JsonResponse
    {
        if ($enrollment->status === EnrollmentStatus::Cancelled) {
            throw DomainException::conflict('This enrollment is already cancelled.', 'already_cancelled');
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        $enrollment->fill([
            'status' => EnrollmentStatus::Cancelled->value,
            'cancelled_at' => now(),
            'cancellation_reason' => $data['reason'],
            'access_end_at' => now(),
        ])->save();

        $this->audit->log('enrollment.cancelled', $enrollment, $request->user(), $data['reason']);

        return ApiResponse::message('Enrollment cancelled. The student no longer has access; payment and attendance history are unaffected.');
    }

    /**
     * Permanently deletes an enrolment record.
     *
     * Every foreign key pointing at an enrolment (payments, attendance,
     * attempts, receipts) nulls out rather than cascading, so this can never
     * destroy another record — but it does erase the seat's own history, so
     * it's refused once a real payment is behind it. Cancel that one instead.
     */
    public function destroy(Request $request, Enrollment $enrollment): JsonResponse
    {
        if ($enrollment->approved_payment_id !== null || $enrollment->payments()->exists()) {
            throw DomainException::conflict(
                'This enrollment is tied to a payment record and can only be cancelled, not deleted, to keep that payment traceable.',
                'enrollment_has_payment',
            );
        }

        $this->audit->log('enrollment.deleted', $enrollment, $request->user(), targetLabel: $enrollment->user?->name ?? $enrollment->id);
        $enrollment->delete();

        return ApiResponse::message('Enrollment permanently deleted.');
    }

    public function export(Request $request): StreamedResponse
    {
        $this->audit->log('export.generated', actor: $request->user(), properties: ['dataset' => 'staff-enrollments'], targetLabel: 'Export: enrollments');

        $query = Enrollment::query()
            ->with(['user:id,name,student_code', 'course:id,title', 'batch:id,title'])
            ->orderByDesc('created_at');

        return CsvStream::fromQuery(
            $query,
            ['Enrollment', 'Student code', 'Student', 'Course', 'Batch', 'Status', 'Access until', 'Source'],
            fn (Enrollment $enrollment) => [
                $enrollment->id,
                $enrollment->user?->student_code,
                $enrollment->user?->name,
                $enrollment->course?->title,
                $enrollment->batch?->title,
                $enrollment->status->value,
                $enrollment->access_end_at,
                $enrollment->source,
            ],
            'enrollments-'.now()->format('Y-m-d').'.csv',
        );
    }

    protected function payload(Enrollment $enrollment): array
    {
        return [
            'id' => $enrollment->id,
            'student_name' => $enrollment->user?->name ?? 'Removed account',
            'course_title' => $enrollment->course?->title ?? 'Course removed',
            'batch_title' => $enrollment->batch?->title ?? 'Batch removed',
            'access_end_at' => $enrollment->access_end_at?->toIso8601String() ?? '',
            'status' => $enrollment->status->value,
        ];
    }

    protected function detailPayload(Enrollment $enrollment): array
    {
        return [
            'id' => $enrollment->id,
            'student_id' => $enrollment->user?->id,
            'student_name' => $enrollment->user?->name ?? 'Removed account',
            'student_code' => $enrollment->user?->student_code,
            'student_mobile' => $enrollment->user?->mobile,
            'student_email' => $enrollment->user?->email,
            'course_id' => $enrollment->course?->id,
            'course_title' => $enrollment->course?->title ?? 'Course removed',
            'batch_id' => $enrollment->batch?->id,
            'batch_title' => $enrollment->batch?->title ?? 'Batch removed',
            'status' => $enrollment->status->value,
            'source' => $enrollment->source,
            'access_start_at' => $enrollment->access_start_at?->toIso8601String(),
            'access_end_at' => $enrollment->access_end_at?->toIso8601String(),
            'activated_at' => $enrollment->activated_at?->toIso8601String(),
            'cancelled_at' => $enrollment->cancelled_at?->toIso8601String(),
            'cancellation_reason' => $enrollment->cancellation_reason,
            'has_payment' => $enrollment->approved_payment_id !== null,
            'attendance_percent' => $enrollment->attendance_percent,
            'recording_percent' => $enrollment->recording_percent,
            'test_percent' => $enrollment->test_percent,
            'overall_percent' => $enrollment->overall_percent,
            'created_at' => $enrollment->created_at?->toIso8601String(),
        ];
    }
}
