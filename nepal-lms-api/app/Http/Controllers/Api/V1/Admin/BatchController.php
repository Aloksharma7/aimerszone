<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\BatchStatus;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Payment;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BatchController extends Controller
{
    public function __construct(protected AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        $batches = Batch::query()
            ->with(['course:id,title', 'teachers:id,name'])
            ->withCount(['enrollments as students_count' => fn ($query) => $query->accessible()])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->when($request->filled('course_id'), fn ($query) => $query->where('course_id', $request->string('course_id')->value()))
            ->orderByDesc('start_at')
            ->paginate($this->perPage(100));

        return ApiResponse::paginated($batches, fn (Batch $batch) => $this->payload($batch));
    }

    public function show(Batch $batch): JsonResponse
    {
        $batch->load(['course:id,title', 'teachers:id,name'])
            ->loadCount(['enrollments as students_count' => fn ($query) => $query->accessible()]);

        return ApiResponse::item($this->payload($batch));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        /*
         * teacher_ids is a pivot relationship, not a batch column.
         *
         * update() already stripped it; store() did not, so creating a batch
         * with a teacher selected threw "Add fillable property [teacher_ids]"
         * instead of saving. Making it fillable would be the wrong repair —
         * it has no column to be assigned to.
         */
        $attributes = collect($data)->except('teacher_ids')->all();

        $batch = Batch::create(array_merge($attributes, [
            'code' => $data['code'] ?? 'B-'.Str::upper(Str::random(8)),
            'public_id' => (string) Str::uuid(),
            'created_by' => $request->user()->getKey(),
        ]));

        $this->syncTeachers($batch, $data['teacher_ids'] ?? null);

        $this->audit->log('batch.created', $batch, $request->user());

        return ApiResponse::item(['id' => $batch->id], status: 201);
    }

    public function update(Request $request, Batch $batch): JsonResponse
    {
        $data = $this->validated($request, $batch);

        $batch->fill(collect($data)->except('teacher_ids')->all())->save();

        if (array_key_exists('teacher_ids', $data)) {
            $this->syncTeachers($batch, $data['teacher_ids']);
        }

        $this->audit->log('batch.updated', $batch, $request->user(), properties: ['fields' => array_keys($data)]);

        return ApiResponse::item(['id' => $batch->id]);
    }

    protected function payload(Batch $batch): array
    {
        return [
            'id' => $batch->id,
            'title' => $batch->title,
            'course_title' => $batch->course?->title ?? 'Course removed',
            // Every assigned teacher, not just the first — a batch shared
            // between two teachers showed only one of them in every list.
            'teacher_name' => $batch->teachers->pluck('name')->join(', ') ?: null,
            'teacher_names' => $batch->teachers->pluck('name')->all(),
            'schedule_summary' => $batch->schedule_summary,
            'students_count' => (int) ($batch->students_count ?? 0),
            'capacity' => (int) ($batch->capacity ?? 0),
            'start_at' => $batch->start_at?->toIso8601String(),
            'end_at' => $batch->end_at?->toIso8601String(),
            'status' => $batch->status->value,

            /*
             * Raw identifiers and date-only values for the edit form.
             *
             * It previously had to re-derive the course and teacher by matching
             * the displayed *names* back against the option lists, and fed a
             * formatted date ("12 Aug 2026") into <input type="date">, which
             * only accepts YYYY-MM-DD and silently renders empty.
             */
            'course_id' => $batch->course_id,
            'teacher_ids' => $batch->teachers->pluck('id')->all(),
            'start_date' => $batch->start_at?->toDateString(),
            'end_date' => $batch->end_at?->toDateString(),
            'access_until_date' => $batch->access_until?->toDateString(),
            'price_npr' => (int) ($batch->price_npr ?? 0),
        ];
    }

    /** Only users who actually hold the teacher role may be assigned. */
    /**
     * Archives a batch.
     *
     * Soft delete, for the same reason as courses: payments, receipts and
     * attendance all point here, and removing the row would strand a
     * student's paid history. A batch with students who still have access is
     * refused — archiving it would silently cut them off mid-course.
     */
    public function destroy(Request $request, Batch $batch): JsonResponse
    {
        $active = $batch->enrollments()->accessible()->count();

        if ($active > 0) {
            throw DomainException::conflict(
                "This batch has {$active} student".($active === 1 ? '' : 's')
                    .' with active access. Move them to another batch, or let their access end, before archiving it.',
                'batch_in_use',
            );
        }

        $pendingPayments = Payment::query()
            ->where('batch_id', $batch->getKey())
            ->pendingReview()
            ->exists();

        if ($pendingPayments) {
            throw DomainException::conflict(
                'This batch has payments still awaiting review. Decide those first, or the students who paid have no route to access.',
                'batch_has_pending_payments',
            );
        }

        $this->audit->log('batch.archived', $batch, $request->user());
        $batch->delete();

        return ApiResponse::message('Batch archived. Payment and attendance history are unaffected.');
    }

    protected function syncTeachers(Batch $batch, ?array $teacherIds): void
    {
        if ($teacherIds === null) {
            return;
        }

        $valid = User::query()
            ->whereIn('id', $teacherIds)
            ->withRole('teacher')
            ->pluck('id');

        $batch->teachers()->sync(
            $valid->mapWithKeys(fn ($id, $index) => [$id => ['is_lead' => $index === 0]])->all(),
        );
    }

    protected function validated(Request $request, ?Batch $existing = null): array
    {
        return $request->validate([
            'course_id' => [$existing ? 'sometimes' : 'required', 'string', Rule::exists('courses', 'id')->whereNull('deleted_at')],
            'title' => [$existing ? 'sometimes' : 'required', 'string', 'min:2', 'max:160'],
            'code' => ['sometimes', 'nullable', 'string', 'max:40', Rule::unique('batches', 'code')->ignore($existing?->getKey())->whereNull('deleted_at')],
            'status' => ['sometimes', Rule::in(BatchStatus::values())],
            'start_at' => ['sometimes', 'nullable', 'date'],
            'end_at' => ['sometimes', 'nullable', 'date', 'after_or_equal:start_at'],

            // Content access normally outlives the teaching period.
            'access_until' => ['sometimes', 'nullable', 'date', 'after_or_equal:end_at'],

            'schedule_summary' => ['sometimes', 'nullable', 'string', 'max:180'],
            'schedule_days' => ['sometimes', 'nullable', 'array', 'max:7'],
            'schedule_days.*' => ['string', 'max:12'],
            'class_start_time' => ['sometimes', 'nullable', 'date_format:H:i'],
            'class_end_time' => ['sometimes', 'nullable', 'date_format:H:i'],
            'price_npr' => ['sometimes', 'integer', 'min:0', 'max:10000000'],
            'capacity' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:5000'],
            // Previously had no floor at all: sending teacher_ids: []
            // successfully detached every teacher via sync([]), masked only
            // by a client-side check in the one first-party admin UI — any
            // direct API call bypassed it entirely and could leave a batch
            // teacherless, unable to start classes or mark attendance.
            'teacher_ids' => ['sometimes', 'array', 'min:1', 'max:5'],
            'teacher_ids.*' => ['string', Rule::exists('users', 'id')->whereNull('deleted_at')],
        ]);
    }
}
