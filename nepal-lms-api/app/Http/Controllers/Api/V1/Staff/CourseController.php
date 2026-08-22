<?php

namespace App\Http\Controllers\Api\V1\Staff;

use App\Enums\CourseStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\CourseDetailResource;
use App\Http\Resources\CourseSummaryResource;
use App\Models\Course;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Catalogue editing for the enrollment office.
 *
 * Same underlying records as the admin controller, but reached through the
 * courses.create / courses.update / courses.publish permissions rather than
 * the administrator role.
 */
class CourseController extends Controller
{
    public function __construct(protected AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        $courses = Course::query()
            ->with(['category', 'owner:id,name', 'batches.teachers.teacherProfile'])
            ->withCount(['modules', 'enrollments', 'batches'])
            ->search($request->string('q')->value())
            ->orderByDesc('updated_at')
            ->paginate($this->perPage(100));

        return ApiResponse::paginated($courses, fn (Course $course) => array_merge(
            (new CourseSummaryResource($course))->toArray($request),
            [
                'enrollments_count' => (int) $course->enrollments_count,
                'batches_count' => (int) $course->batches_count,
                'owner_name' => $course->owner?->name ?? 'Enrollment Team',
                'updated_at' => $course->updated_at?->toIso8601String(),
            ],
        ));
    }

    public function show(Request $request, string $course): JsonResponse
    {
        $model = $this->resolve($course);

        $model->load(['category', 'modules.lessons', 'batches.teachers.teacherProfile'])->loadCount('modules');

        return ApiResponse::item(new CourseDetailResource($model));
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Course::class);

        $data = $this->validated($request);

        // Publishing on create is a separate permission from creating, same as
        // it is on update() below — an officer without it can still draft one.
        // No Course instance exists yet to run the publish policy against, so
        // this checks the same underlying permission directly.
        $publish = ($data['published'] ?? false) && $request->user()->hasPermission('courses.publish');

        $course = Course::create(array_merge($data, [
            'slug' => $data['slug'] ?? Str::slug($data['title']),
            'code' => $data['code'] ?? Str::upper(Str::slug(Str::limit($data['title'], 20, ''), '_')),
            'status' => $publish ? CourseStatus::Published->value : CourseStatus::Draft->value,
            'published' => $publish,
            'published_at' => $publish ? now() : null,
            'owner_id' => $request->user()->getKey(),
            'created_by' => $request->user()->getKey(),
            'updated_by' => $request->user()->getKey(),
        ]));

        $this->audit->log('course.created', $course, $request->user());

        return ApiResponse::item(['id' => $course->id, 'slug' => $course->slug], status: 201);
    }

    public function update(Request $request, string $course): JsonResponse
    {
        $model = $this->resolve($course);

        $this->authorize('update', $model);

        $data = $this->validated($request, $model);

        // Publishing is a separate permission from editing, so an officer who
        // may draft a course cannot necessarily put it on the public site.
        if (array_key_exists('published', $data)) {
            $this->authorize('publish', $model);

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

        $this->authorize('update', $model);

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

        $this->authorize('update', $model);

        if ($model->thumbnail_path) {
            if (! Str::startsWith($model->thumbnail_path, ['http://', 'https://'])) {
                Storage::disk('public')->delete($model->thumbnail_path);
            }

            $model->forceFill(['thumbnail_path' => null, 'updated_by' => $request->user()->getKey()])->save();

            $this->audit->log('course.thumbnail_removed', $model, $request->user(), targetLabel: $model->title);
        }

        return ApiResponse::message('Thumbnail removed.');
    }

    protected function resolve(string $identifier): Course
    {
        return Course::query()->where('id', $identifier)->orWhere('slug', $identifier)->firstOrFail();
    }

    protected function validated(Request $request, ?Course $existing = null): array
    {
        $data = $request->validate([
            'title' => [$existing ? 'sometimes' : 'required', 'string', 'min:2', 'max:180'],
            'slug' => ['sometimes', 'string', 'max:160', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('courses', 'slug')->ignore($existing?->getKey())->whereNull('deleted_at')],
            'code' => ['sometimes', 'nullable', 'string', 'max:32', Rule::unique('courses', 'code')->ignore($existing?->getKey())->whereNull('deleted_at')],
            'category_id' => ['sometimes', 'nullable', 'string', Rule::exists('categories', 'id')],
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
