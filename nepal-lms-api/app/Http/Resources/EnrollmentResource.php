<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** ApiEnrollment — consumed by mapEnrollment(). */
class EnrollmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'course' => (new CourseSummaryResource($this->course))->toArray($request),
            'batch' => (new BatchResource($this->batch))->toArray($request),
            'access_start_at' => $this->access_start_at?->toIso8601String(),
            'access_end_at' => $this->access_end_at?->toIso8601String(),
            'progress' => [
                'attendance_percent' => (int) $this->attendance_percent,
                'recording_percent' => (int) $this->recording_percent,
                'test_percent' => (int) $this->test_percent,
                'syllabus_percent' => (int) $this->syllabus_percent,
                'overall_percent' => (int) $this->overall_percent,
            ],
            'next_action' => $this->additional['next_action'] ?? null,
        ];
    }
}
