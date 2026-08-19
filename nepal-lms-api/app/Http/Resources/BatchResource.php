<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ApiBatch. Join URLs and passcodes are deliberately absent — those are only
 * ever issued through the authorized join endpoint.
 */
class BatchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'status' => $this->status->value,
            'start_at' => $this->start_at?->toIso8601String(),
            'end_at' => $this->end_at?->toIso8601String(),
            'access_until' => $this->access_until?->toIso8601String(),
            'schedule_summary' => $this->schedule_summary,
            'price_npr' => (int) $this->price_npr,
            'capacity' => $this->capacity,
            'teacher_names' => $this->whenLoaded('teachers', fn () => $this->teachers->pluck('name')->all(), []),
        ];
    }
}
