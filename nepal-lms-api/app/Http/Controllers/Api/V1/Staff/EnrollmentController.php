<?php

namespace App\Http\Controllers\Api\V1\Staff;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Enrollment;
use App\Models\EnrollmentRequest;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use App\Support\CsvStream;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
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
     * An exception request — scholarship, transfer or an approved institutional
     * case. Deliberately does not grant access: it records the ask for an
     * authorized reviewer, which is what keeps free seats auditable.
     */
    public function requestEnrollment(Request $request): JsonResponse
    {
        $data = $request->validate([
            'student_id' => ['required', 'string'],
            'course_id' => ['required', 'string'],
            'batch_id' => ['nullable', 'string'],
            'reason' => ['required', Rule::in(['scholarship', 'transfer', 'institutional_exception'])],
            'explanation' => ['required', 'string', 'min:10', 'max:2000'],
        ]);

        $student = User::findOrFail($data['student_id']);

        // The frontend sends a course id; resolve a batch when one is not named.
        $batch = filled($data['batch_id'] ?? null)
            ? Batch::where('id', $data['batch_id'])->where('course_id', $data['course_id'])->firstOrFail()
            : Batch::where('course_id', $data['course_id'])->enrollable()->orderBy('start_at')->firstOrFail();

        $enrollmentRequest = EnrollmentRequest::create([
            'user_id' => $student->getKey(),
            'course_id' => $batch->course_id,
            'batch_id' => $batch->getKey(),
            'status' => 'pending',
            'basis' => $data['reason'],
            'note' => $data['explanation'],
            'requested_by' => $request->user()->getKey(),
        ]);

        $this->audit->log('enrollment.requested', $enrollmentRequest, $request->user(), $data['explanation'], [
            'basis' => $data['reason'],
            'student_id' => $student->getKey(),
        ]);

        return ApiResponse::item([
            'id' => $enrollmentRequest->id,
            'status' => 'pending',
            'message' => 'The request was recorded for authorized review. No access has been activated.',
        ], status: 201);
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
}
