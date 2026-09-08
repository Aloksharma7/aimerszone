<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ApiClassSession.
 *
 * join_available and action_reason are decided by the server; the frontend
 * renders the answer and never computes the window itself. No join URL appears
 * here — that is issued only by POST /student/classes/{id}/join.
 */
class ClassSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'enrollment_id' => $this->additional['enrollment_id'] ?? null,
            'topic' => $this->topic,
            'course_title' => $this->batch?->course?->title,
            'batch_title' => $this->batch?->title,
            'teacher_name' => $this->teacher?->name,
            'status' => $this->effectiveStatus()->value,
            'starts_at' => $this->starts_at->toIso8601String(),
            'ends_at' => $this->ends_at->toIso8601String(),
            'join_available' => (bool) ($this->additional['join_available'] ?? false),
            'action_reason' => $this->additional['action_reason'] ?? null,
        ];
    }
}
