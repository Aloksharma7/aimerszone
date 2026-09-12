<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\BatchStatus;
use App\Enums\CourseStatus;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Http\Resources\CourseDetailResource;
use App\Http\Resources\CourseSummaryResource;
use App\Models\Batch;
use App\Models\Course;
use App\Models\Enrollment;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Course catalogue administration.
 *
 * Unlike the public catalogue this returns drafts and archived courses too,
 * which is why it sits behind courses.view rather than being open.
 */
class CourseController extends Controller
{
    public function __construct(protected AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        // "archived" here means soft-deleted (see destroy()), not the unused
        // CourseStatus::Archived status value — reusing that word is what
        // lets the admin UI surface a filter for it without a new query param.
        $archived = $request->string('status')->value() === 'archived';

        $courses = Course::query()
            ->when($archived, fn ($query) => $query->onlyTrashed())
            ->with(['category', 'batches.teachers.teacherProfile'])
            ->withCount('modules')
            ->search($request->string('q')->value())
            ->when($request->filled('status') && ! $archived, fn ($query) => $query->where('status', $request->string('status')->value()))
            ->when($request->filled('category_id'), fn ($query) => $query->where('category_id', $request->string('category_id')->value()))
            ->orderByDesc('updated_at')
            ->paginate($this->perPage(100));

        return ApiResponse::paginated($courses, fn (Course $course) => (new CourseSummaryResource($course))->toArray($request));
    }

    public function show(Request $request, string $course): JsonResponse
    {
        $model = $this->resolve($course);

        $model->load(['category', 'modules.lessons', 'batches.teachers.teacherProfile'])->loadCount('modules');

        return ApiResponse::item(new CourseDetailResource($model));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $course = Course::create(array_merge($data, [
            'code' => $data['code'] ?? Str::upper(Str::slug(Str::limit($data['title'], 20, ''), '_')),
            'status' => ($data['published'] ?? false) ? CourseStatus::Published->value : CourseStatus::Draft->value,
            'published_at' => ($data['published'] ?? false) ? now() : null,
            'created_by' => $request->user()->getKey(),
            'updated_by' => $request->user()->getKey(),
        ]));

        $this->audit->log('course.created', $course, $request->user());

        return ApiResponse::item(['id' => $course->id, 'slug' => $course->slug], status: 201);
    }

    public function update(Request $request, string $course): JsonResponse
    {
        $model = $this->resolve($course);
        $data = $this->validated($request, $model);

        // Publishing is a state transition, not just a boolean flip: the
        // status and the publication timestamp move together.
        if (array_key_exists('published', $data)) {
            $data['status'] = $data['published'] ? CourseStatus::Published->value : CourseStatus::Draft->value;
            $data['published_at'] = $data['published'] ? ($model->published_at ?? now()) : null;
        }

        $model->fill($data + ['updated_by' => $request->user()->getKey()])->save();

        $this->audit->log('course.updated', $model, $request->user(), properties: ['fields' => array_keys($data)]);

        return ApiResponse::item(['id' => $model->id, 'slug' => $model->slug]);
    }

    /** Uploads a thumbnail file, as an alternative to the thumbnail_url field on update(). */
    public function uploadThumbnail(Request $request, string $course): JsonResponse
    {
        $model = $this->resolve($course);
        $maxKb = (int) config('lms.uploads.image_max_kb', 2048);

        $request->validate([
            'thumbnail' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.$maxKb],
        ]);

        $previous = $model->thumbnail_path;
        $path = $request->file('thumbnail')->store('courses/thumbnails', 'public');

        $model->forceFill(['thumbnail_path' => $path, 'updated_by' => $request->user()->getKey()])->save();

        // Deleted only after the new file is safely stored and saved, and
        // only when the previous value was actually a local file — a
        // pasted external URL is never something this disk can delete.
        if ($previous && ! Str::startsWith($previous, ['http://', 'https://'])) {
            Storage::disk('public')->delete($previous);
        }

        $this->audit->log('course.thumbnail_updated', $model, $request->user(), targetLabel: $model->title);

        return ApiResponse::item(['thumbnail_url' => $model->thumbnailUrl()]);
    }

    public function deleteThumbnail(Request $request, string $course): JsonResponse
    {
        $model = $this->resolve($course);

        if ($model->thumbnail_path) {
            if (! Str::startsWith($model->thumbnail_path, ['http://', 'https://'])) {
                Storage::disk('public')->delete($model->thumbnail_path);
            }

            $model->forceFill(['thumbnail_path' => null, 'updated_by' => $request->user()->getKey()])->save();

            $this->audit->log('course.thumbnail_removed', $model, $request->user(), targetLabel: $model->title);
        }

        return ApiResponse::message('Thumbnail removed.');
    }

    /**
     * Archives a course.
     *
     * This is a soft delete: the row stays, and every read path already
     * filters on deleted_at. That matters because enrolments, payments and
     * receipts all reference the course, and a hard delete would leave a
     * student's paid history pointing at nothing.
     *
     * A course with live enrolments is refused rather than archived — the
     * students would lose access with no explanation and no audit trail
     * connecting the two events.
     */
    public function destroy(Request $request, string $course): JsonResponse
    {
        $model = $this->resolve($course);

        $activeEnrollments = Enrollment::query()
            ->where('course_id', $model->getKey())
            ->accessible()
            ->count();

        if ($activeEnrollments > 0) {
            throw DomainException::conflict(
                "This course has {$activeEnrollments} student".($activeEnrollments === 1 ? '' : 's')
                    .' with active access. Let their access end, or move them to another course, before archiving it.',
                'course_in_use',
            );
        }

        $openBatches = Batch::query()
            ->where('course_id', $model->getKey())
            ->whereIn('status', [BatchStatus::Open->value, BatchStatus::Ongoing->value])
            ->count();

        if ($openBatches > 0) {
            throw DomainException::conflict(
                'This course still has open or ongoing batches. Close them first.',
                'course_has_open_batches',
            );
        }

        $this->audit->log('course.archived', $model, $request->user());
        $model->delete();

        return ApiResponse::message('Course archived. Enrolment history and receipts are unaffected.');
    }

    /** Brings an archived course back — it reappears in every list exactly as it was. */
    public function restore(Request $request, string $course): JsonResponse
    {
        $model = $this->resolveAny($course);
        $model->restore();

        $this->audit->log('course.restored', $model, $request->user());

        return ApiResponse::message('Course restored.');
    }

    /**
     * Permanently deletes a course — the "proper delete" an archive can't
     * give you, for the courses that genuinely never went anywhere.
     *
     * Only allowed once the course has zero enrolments and zero batches,
     * ever (not just active ones): the FK on both tables cascades on delete,
     * so anything short of that would silently wipe payment and attendance
     * rows a hard delete has no business touching. A course with any history
     * stays archive-only, same as before.
     */
    public function forceDestroy(Request $request, string $course): JsonResponse
    {
        $model = $this->resolveAny($course);

        $everEnrolled = Enrollment::query()->where('course_id', $model->getKey())->count();

        if ($everEnrolled > 0) {
            throw DomainException::conflict(
                "This course has {$everEnrolled} enrolment".($everEnrolled === 1 ? '' : 's').' on record and can only be archived, not deleted, so that payment and attendance history is kept.',
                'course_has_history',
            );
        }

        $everHadBatch = Batch::withTrashed()->where('course_id', $model->getKey())->count();

        if ($everHadBatch > 0) {
            throw DomainException::conflict(
                'This course has batches on record (including archived ones) and can only be archived, not deleted. Permanently delete those batches first.',
                'course_has_batches',
            );
        }

        $this->audit->log('course.deleted', $model, $request->user(), targetLabel: $model->title);
        $model->forceDelete();

        return ApiResponse::message('Course permanently deleted.');
    }

    /** Slug or id, so admin links keep working after a slug change. */
    protected function resolve(string $identifier): Course
    {
        return Course::query()
            ->where('id', $identifier)
            ->orWhere('slug', $identifier)
            ->firstOrFail();
    }

    /** Same as resolve(), but reaches archived courses too — needed to restore or permanently delete one. */
    protected function resolveAny(string $identifier): Course
    {
        return Course::withTrashed()
            ->where('id', $identifier)
            ->orWhere('slug', $identifier)
            ->firstOrFail();
    }

    protected function validated(Request $request, ?Course $existing = null): array
    {
        $data = $request->validate([
            'title' => [$existing ? 'sometimes' : 'required', 'string', 'min:2', 'max:180'],
            'slug' => [
                $existing ? 'sometimes' : 'required',
                'string', 'max:160', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('courses', 'slug')->ignore($existing?->getKey())->whereNull('deleted_at'),
            ],
            'code' => ['sometimes', 'nullable', 'string', 'max:32', Rule::unique('courses', 'code')->ignore($existing?->getKey())->whereNull('deleted_at')],
            'category_id' => ['sometimes', 'nullable', 'string', Rule::exists('categories', 'id')],
            'short_title' => ['sometimes', 'nullable', 'string', 'max:120'],
            'short_description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'description' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'access_type' => [$existing ? 'sometimes' : 'required', Rule::in(['free', 'paid'])],
            'price_npr' => ['sometimes', 'integer', 'min:0', 'max:10000000'],
            'original_price_npr' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:10000000'],

            // Stored in the same thumbnail_path column a file upload would
            // use; Course::thumbnailUrl() returns an absolute URL as-is.
            'thumbnail_url' => ['sometimes', 'nullable', 'url', 'max:2048'],

            'features' => ['sometimes', 'array', 'max:8'],
            'features.*' => ['string', Rule::in(['Live', 'Recordings', 'Tests', 'Notes'])],
            'published' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('thumbnail_url', $data)) {
            $data['thumbnail_path'] = $data['thumbnail_url'];
            unset($data['thumbnail_url']);
        }

        return $data;
    }
}
