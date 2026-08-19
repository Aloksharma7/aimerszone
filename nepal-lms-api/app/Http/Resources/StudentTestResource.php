<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ApiTest for the student view.
 *
 * `score` is only populated once the test's release policy is satisfied, so a
 * student cannot read their mark early by inspecting the list payload.
 */
class StudentTestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $released = $this->resultsAreReleased();
        $bestScore = $this->additional['best_score'] ?? null;

        return [
            'id' => $this->id,
            'enrollment_id' => $this->additional['enrollment_id'] ?? null,
            'course_title' => $this->course?->title,
            'title' => $this->title,
            'status' => $this->displayStatus($released),
            'opens_at' => $this->opens_at?->toIso8601String(),
            'closes_at' => $this->closes_at?->toIso8601String(),
            'duration_minutes' => (int) $this->duration_minutes,
            'total_marks' => (int) $this->total_marks,
            'score' => $released ? $bestScore : null,
            'attempts_used' => (int) ($this->additional['attempts_used'] ?? 0),
            'attempts_allowed' => (int) $this->attempts_allowed,
        ];
    }

    /**
     * Collapses the stored status into what the student should see right now.
     * A "scheduled" test whose window has opened reads as open.
     */
    protected function displayStatus(bool $released): string
    {
        if ($released && ($this->additional['attempts_used'] ?? 0) > 0) {
            return 'result_released';
        }

        if ($this->isOpenNow()) {
            return 'open';
        }

        if ($this->opens_at !== null && $this->opens_at->isFuture()) {
            return 'scheduled';
        }

        return 'closed';
    }
}
