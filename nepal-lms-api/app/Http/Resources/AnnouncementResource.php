<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** ApiAnnouncement, shared by the notifications feed and course announcements. */
class AnnouncementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'summary' => $this->summary,
            'body' => $this->body,
            'course_title' => $this->course?->title ?? $this->batch?->course?->title,
            'published_at' => $this->published_at?->toIso8601String(),
            'pinned' => (bool) $this->pinned,
            'read' => (bool) ($this->additional['read'] ?? false),
            'href' => $this->link,
        ];
    }
}
