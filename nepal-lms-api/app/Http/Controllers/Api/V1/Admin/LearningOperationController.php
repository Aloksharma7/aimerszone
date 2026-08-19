<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\BatchStatus;
use App\Enums\ClassSessionStatus;
use App\Enums\RecordingState;
use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\ClassSession;
use App\Models\Recording;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * Operational items across teaching, merged into one ordered list: what is
 * live right now, what a teacher still owes, and what is misconfigured.
 */
class LearningOperationController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $items = collect()
            ->merge($this->liveSessions())
            ->merge($this->pendingAttendance())
            ->merge($this->stalledRecordings())
            ->merge($this->draftBatches())
            ->take((int) request()->integer('per_page', 100));

        return ApiResponse::collection($items->values());
    }

    protected function liveSessions()
    {
        return ClassSession::query()
            ->where('status', ClassSessionStatus::Live->value)
            ->with('batch.course:id,title')
            ->limit(10)
            ->get()
            ->map(fn (ClassSession $session) => [
                'id' => 'session-'.$session->id,
                'type' => 'Session',
                'title' => $session->topic,
                'detail' => ($session->batch?->course?->title ?? 'Course').' · Live now',
                'status' => 'Live now',
                'href' => '/admin/classes/'.$session->id,
            ]);
    }

    /** A finished class whose register was never finalized. */
    protected function pendingAttendance()
    {
        return ClassSession::query()
            ->where('ends_at', '<', now())
            ->whereNull('attendance_finalized_at')
            ->where('status', '!=', ClassSessionStatus::Cancelled->value)
            ->with('batch.course:id,title')
            ->orderBy('ends_at')
            ->limit(15)
            ->get()
            ->map(fn (ClassSession $session) => [
                'id' => 'attendance-'.$session->id,
                'type' => 'Attendance',
                'title' => $session->topic,
                'detail' => ($session->batch?->title ?? 'Batch').' · awaiting finalization',
                'status' => 'Needs action',
                'href' => '/admin/attendance',
            ]);
    }

    protected function stalledRecordings()
    {
        return Recording::query()
            ->where('state', RecordingState::Processing->value)
            ->where('created_at', '<', now()->subHours(6))
            ->with('batch:id,title')
            ->limit(15)
            ->get()
            ->map(fn (Recording $recording) => [
                'id' => 'recording-'.$recording->id,
                'type' => 'Recording',
                'title' => $recording->title,
                'detail' => 'Provider processing incomplete',
                'status' => 'Pending',
                'href' => '/admin/integrations/youtube',
            ]);
    }

    protected function draftBatches()
    {
        return Batch::query()
            ->where('status', BatchStatus::Draft->value)
            ->with('course:id,title')
            ->limit(15)
            ->get()
            ->map(fn (Batch $batch) => [
                'id' => 'batch-'.$batch->id,
                'type' => 'Batch',
                'title' => $batch->title,
                'detail' => $this->missingFor($batch),
                'status' => 'Draft',
                'href' => '/admin/batches/'.$batch->id,
            ]);
    }

    protected function missingFor(Batch $batch): string
    {
        $missing = [];

        if (! $batch->teachers()->exists()) {
            $missing[] = 'teacher';
        }

        if (blank($batch->schedule_summary)) {
            $missing[] = 'schedule';
        }

        if ($batch->start_at === null) {
            $missing[] = 'start date';
        }

        return $missing === []
            ? 'Ready to open'
            : ucfirst(implode(' and ', $missing)).' required';
    }
}
