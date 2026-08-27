<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ApiRecording. The playback destination is deliberately absent: the frontend
 * asks for it separately so every play is authorized at that moment.
 */
class RecordingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'enrollment_id' => $this->additional['enrollment_id'] ?? null,
            'course_title' => $this->batch?->course?->title,
            'batch_title' => $this->batch?->title,
            'title' => $this->title,
            'module_title' => $this->module_title,
            'recorded_at' => $this->recorded_at?->toIso8601String(),
            'released_at' => $this->released_at?->toIso8601String(),
            'teacher_name' => $this->relationLoaded('session') ? $this->session?->teacher?->name : null,
            'duration_seconds' => $this->duration_seconds,
            'progress_percent' => (int) ($this->additional['progress_percent'] ?? 0),
            'state' => $this->state->value,
            'sync_message' => $this->state === \App\Enums\RecordingState::Processing ? $this->sync_message : null,
            'thumbnail_url' => $this->thumbnail_url,
            'youtube_video_id' => $this->source === 'youtube' ? $this->youtube_video_id : null,
            'syllabus_lesson_id' => $this->syllabus_lesson_id,
        ];
    }
}
