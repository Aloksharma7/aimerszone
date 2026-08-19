<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\CourseDetailResource;
use App\Http\Resources\CourseSummaryResource;
use App\Models\Category;
use App\Models\Course;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Unauthenticated course catalogue.
 *
 * Only published courses are exposed, and only their enrollable batches, so a
 * draft course or a cancelled cohort can never leak through the public site.
 */
class CatalogueController extends Controller
{
    public function categories(): JsonResponse
    {
        $categories = Category::active()
            ->withCount(['courses' => fn ($query) => $query->publiclyVisible()])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return ApiResponse::collection(CategoryResource::collection($categories));
    }

    public function courses(Request $request): JsonResponse
    {
        $courses = Course::publiclyVisible()
            ->with([
                'category',
                'batches' => fn ($query) => $query->enrollable()->orderBy('start_at'),
                'batches.teachers.teacherProfile',
            ])
            ->withCount('modules')
            ->when($request->filled('category'), fn ($query) => $query->whereHas(
                'category',
                fn ($builder) => $builder->where('slug', $request->string('category')->value()),
            ))
            ->when($request->filled('access_type'), fn ($query) => $query->where('access_type', $request->string('access_type')->value()))
            ->search($request->string('q')->value())
            ->orderByDesc('published_at')
            ->paginate($this->perPage(24));

        return ApiResponse::paginated($courses, fn (Course $course) => (new CourseSummaryResource($course))->toArray($request));
    }

    public function course(Request $request, string $slug): JsonResponse
    {
        $course = Course::publiclyVisible()
            ->with([
                'category',
                'modules.lessons',
                'batches' => fn ($query) => $query->enrollable()->orderBy('start_at'),
                'batches.teachers.teacherProfile',
            ])
            ->withCount('modules')
            ->where('slug', $slug)
            ->firstOrFail();

        return ApiResponse::item(new CourseDetailResource($course));
    }
}
