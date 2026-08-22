<?php

namespace App\Http\Controllers\Api\V1\Staff;

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
