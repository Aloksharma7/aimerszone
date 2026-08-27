<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ApiResource. download_url stays null in list payloads — the frontend asks
 * for a short-lived link per download instead of holding one in the page.
 */
class ResourceFileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'enrollment_id' => $this->additional['enrollment_id'] ?? null,
            'course_title' => $this->batch?->course?->title ?? $this->course?->title,
            'title' => $this->title,
            'module_title' => $this->module_title,
            'file_type' => $this->file_type,
            'mime_type' => $this->mime_type,
            'size_bytes' => $this->size_bytes,
            'released_at' => $this->released_at?->toIso8601String(),
            'download_url' => null,
            'syllabus_lesson_id' => $this->syllabus_lesson_id,
        ];
    }
}
