<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Course category management.
 *
 * Categories were readable through the public catalogue but had no write path
 * anywhere, which made the whole catalogue unusable on a fresh install: the
 * course form requires a category and the dropdown could never be populated.
 */
class CategoryController extends Controller
{
    public function __construct(protected AuditLogger $audit) {}

    /** Includes inactive categories, which the public endpoint hides. */
    public function index(Request $request): JsonResponse
    {
        $categories = Category::query()
            ->withCount('courses')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return ApiResponse::collection($categories->map(fn (Category $category) => [
            'id' => $category->id,
            'name' => $category->name,
            'slug' => $category->slug,
            'description' => $category->description,
            'sort_order' => (int) $category->sort_order,
            'is_active' => (bool) $category->is_active,
            'course_count' => (int) $category->courses_count,
        ]));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $category = Category::create(array_merge($data, [
            'slug' => $data['slug'] ?? $this->uniqueSlug($data['name']),
            'is_active' => $data['is_active'] ?? true,
        ]));

        $this->audit->log('category.created', $category, $request->user());

        return ApiResponse::item([
            'id' => $category->id,
            'name' => $category->name,
            'slug' => $category->slug,
        ], status: 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $data = $this->validated($request, $category);

        $category->fill($data)->save();

        $this->audit->log('category.updated', $category, $request->user(), properties: [
            'fields' => array_keys($data),
        ]);

        return ApiResponse::item(['id' => $category->id, 'slug' => $category->slug]);
    }

    /**
     * Deleting a category that still has courses would orphan them in the
     * catalogue, so it is refused. Deactivating hides it from the public site
     * while leaving existing courses intact.
     */
    public function destroy(Request $request, Category $category): JsonResponse
    {
        if ($category->courses()->exists()) {
            throw DomainException::conflict(
                'This category still has courses. Move them first, or deactivate the category instead.',
                'category_in_use',
            );
        }

        $this->audit->log('category.deleted', $category, $request->user());
        $category->delete();

        return ApiResponse::message('Category deleted.');
    }

    protected function validated(Request $request, ?Category $existing = null): array
    {
        return $request->validate([
            'name' => [$existing ? 'sometimes' : 'required', 'string', 'min:2', 'max:120', Rule::unique('categories', 'name')->ignore($existing?->getKey())],
            'slug' => ['sometimes', 'string', 'max:140', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('categories', 'slug')->ignore($existing?->getKey())],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:999'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    protected function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;
        $suffix = 2;

        while (Category::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix++;
        }

        return $slug;
    }
}
