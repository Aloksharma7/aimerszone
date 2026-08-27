<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SyllabusModuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var array<string, bool> $completed */
        $completed = $this->additional['completed_lessons'] ?? [];
        $recordingByLesson = $this->additional['recording_by_lesson'] ?? collect();
        $resourceByLesson = $this->additional['resource_by_lesson'] ?? collect();
        $lessons = $this->whenLoaded('lessons', fn () => $this->lessons, collect());
        $done = $lessons->filter(fn ($lesson) => isset($completed[$lesson->id]))->count();

        return [
            'id' => $this->id,
            'title' => $this->title,
            'order' => (int) $this->order,
            'progress_percent' => $lessons->count() > 0 ? (int) round($done / $lessons->count() * 100) : 0,
            'lessons' => $lessons->map(fn ($lesson) => [
                'id' => $lesson->id,
                'title' => $lesson->title,
                'type' => $lesson->type,
                'state' => isset($completed[$lesson->id]) ? 'Completed' : 'Available',
                'order' => (int) $lesson->order,
                'recording_id' => $recordingByLesson[$lesson->id]->id ?? null,
                'resource_id' => $resourceByLesson[$lesson->id]->id ?? null,
            ])->values()->all(),
        ];
    }
}
