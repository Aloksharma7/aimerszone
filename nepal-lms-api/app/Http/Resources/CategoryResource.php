<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            // Only present when the query used withCount().
            'course_count' => $this->when(
                array_key_exists('courses_count', $this->resource->getAttributes()),
                fn () => (int) $this->resource->getAttributes()['courses_count'],
            ),
        ];
    }
}
