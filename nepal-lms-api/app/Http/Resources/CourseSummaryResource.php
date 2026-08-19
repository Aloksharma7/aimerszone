<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ApiCourseSummary, consumed by mapCourse() in src/lib/data/adapters.ts.
 *
 * The adapter derives status, accent and display strings from these fields, so
 * key names and nullability must not drift.
 */
class CourseSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'code' => $this->code,
            'title' => $this->title,
            'short_title' => $this->short_title,
            'short_description' => $this->short_description,
            'description' => $this->description,
            'category' => $this->whenLoaded('category', fn () => $this->category
                ? (new CategoryResource($this->category))->toArray($request)
                : null),
            'thumbnail_url' => $this->thumbnailUrl(),
            'access_type' => $this->access_type->value,
            'starting_price_npr' => $this->startingPrice(),
            'original_price_npr' => $this->original_price_npr,
            'published' => (bool) $this->published,
            'available_batches' => $this->when(
                $this->relationLoaded('batches'),
                fn () => $this->batches->whereIn('status', ['open', 'ongoing'])->count(),
            ),
            'features' => $this->features ?? ['Live', 'Recordings', 'Tests', 'Notes'],
            'modules_count' => $this->countAttribute('modules_count'),
            'lessons_count' => $this->countAttribute('lessons_count'),
            'batches' => $this->whenLoaded('batches', fn () => BatchResource::collection($this->batches)),
            'teacher' => $this->teacherPayload(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    /** Counts exist only when the query asked for them via withCount(). */
    protected function countAttribute(string $key): mixed
    {
        $attributes = $this->resource->getAttributes();

        return array_key_exists($key, $attributes) ? (int) $attributes[$key] : null;
    }

    /** The lead teacher of the nearest enrollable batch represents the course. */
    protected function teacherPayload(): ?array
    {
        if (! $this->relationLoaded('batches')) {
            return null;
        }

        $teacher = $this->batches
            ->flatMap(fn ($batch) => $batch->relationLoaded('teachers') ? $batch->teachers : collect())
            ->first();

        if ($teacher === null) {
            return null;
        }

        return [
            'id' => $teacher->id,
            'name' => $teacher->name,
            'slug' => $teacher->teacherProfile?->slug,
        ];
    }
}
