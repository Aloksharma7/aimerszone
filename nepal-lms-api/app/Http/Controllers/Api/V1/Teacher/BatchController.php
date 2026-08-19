<?php

namespace App\Http\Controllers\Api\V1\Teacher;

use App\Enums\AttendanceStatus;
use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Attendance;
use App\Models\Batch;
use App\Models\Enrollment;
use App\Models\Recording;
use App\Models\Resource;
use App\Models\Test;
use App\Services\AccessGuard;
use App\Support\ApiResponse;
use App\Support\CsvStream;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BatchController extends Controller
{
    use ResolvesTeacherScope;

    public function __construct(protected AccessGuard $guard) {}

    public function index(Request $request): JsonResponse
    {
        $batches = Batch::query()
            ->whereIn('id', $this->guard->taughtBatchIds($request->user()) ?: ['-'])
            ->with('course:id,title')
            ->withCount(['enrollments as students_count' => fn ($query) => $query->accessible()])
            ->orderByDesc('start_at')
            ->paginate($this->perPage(100));

        $batchIds = $batches->pluck('id')->all();
        $nextSessions = $this->nextSessionsFor($batchIds);
        $syllabusPercents = $this->syllabusProgressFor($batchIds);

        return ApiResponse::paginated($batches, fn (Batch $batch) => $this->batchPayload(
            $batch,
            $nextSessions->get($batch->id, false),
            $syllabusPercents[$batch->id] ?? 0,
        ));
    }

    public function show(Request $request, string $batchId): JsonResponse
    {
        $batch = $this->resolveBatch($batchId, $request->user());

        $enrollments = Enrollment::query()
            ->where('batch_id', $batch->getKey())
            ->accessible()
            ->with('user:id,name,mobile,email,student_code')
            ->get();

        return ApiResponse::item([
            'batch' => $this->batchPayload($batch),
            'students' => $enrollments->map(fn (Enrollment $enrollment) => [
                'id' => $enrollment->user_id,
                'student_code' => $enrollment->user?->student_code,
                'name' => $enrollment->user?->name ?? 'Removed account',
                'mobile' => $enrollment->user?->mobile,
                'email' => $enrollment->user?->email,
                'status' => $enrollment->status->value,
                'joined_at' => $enrollment->activated_at?->toIso8601String(),
            ])->values()->all(),
            'counts' => [
                'classes' => $batch->sessions()->count(),
                'attendance_percent' => $this->attendancePercent($batch),
                'recordings' => Recording::where('batch_id', $batch->getKey())->count(),
                'tests' => Test::where('batch_id', $batch->getKey())->count(),
                'resources' => Resource::where('batch_id', $batch->getKey())->count(),
                'announcements' => Announcement::where('batch_id', $batch->getKey())->count(),
            ],
        ]);
    }

    /** Roster export for offline use; audited like every other extract. */
    public function exportStudents(Request $request, string $batchId): StreamedResponse
    {
        $batch = $this->resolveBatch($batchId, $request->user());

        $query = Enrollment::query()
            ->where('batch_id', $batch->getKey())
            ->accessible()
            ->with('user:id,name,mobile,email,student_code');

        return CsvStream::fromQuery(
            $query,
            ['Student code', 'Name', 'Mobile', 'Email', 'Status', 'Attendance %', 'Tests %', 'Joined'],
            fn (Enrollment $enrollment) => [
                $enrollment->user?->student_code,
                $enrollment->user?->name,
                $enrollment->user?->mobile,
                $enrollment->user?->email,
                $enrollment->status->value,
                $enrollment->attendance_percent,
                $enrollment->test_percent,
                $enrollment->activated_at,
            ],
            'batch-'.$batch->getKey().'-students.csv',
        );
    }

    /** Present, late and excused all count as attended. */
    protected function attendancePercent(Batch $batch): int
    {
        $records = Attendance::query()
            ->whereHas('session', fn ($query) => $query
                ->where('batch_id', $batch->getKey())
                ->whereNotNull('attendance_finalized_at'))
            ->get(['status']);

        if ($records->isEmpty()) {
            return 0;
        }

        $present = $records->filter(fn ($record) => in_array(
            $record->status,
            [AttendanceStatus::Present, AttendanceStatus::Late, AttendanceStatus::Excused],
            true,
        ))->count();

        return (int) round($present / $records->count() * 100);
    }
}
