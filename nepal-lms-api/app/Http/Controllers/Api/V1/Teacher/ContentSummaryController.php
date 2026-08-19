<?php

namespace App\Http\Controllers\Api\V1\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Batch;
use App\Models\Recording;
use App\Models\Resource;
use App\Models\Test;
use App\Services\AccessGuard;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Everything the teacher has published, across their batches. */
class ContentSummaryController extends Controller
{
    use ResolvesTeacherScope;

    public function __construct(protected AccessGuard $guard) {}

    public function __invoke(Request $request): JsonResponse
    {
        $batchIds = $this->guard->taughtBatchIds($request->user()) ?: ['-'];

        $recordings = Recording::query()->whereIn('batch_id', $batchIds)->with('batch')->latest()->limit(5)->get();
        $resources = Resource::query()->whereIn('batch_id', $batchIds)->with('batch')->latest()->limit(5)->get();
        $tests = Test::query()->whereIn('batch_id', $batchIds)->with('batch')->latest()->limit(5)->get();
        $announcements = Announcement::query()->whereIn('batch_id', $batchIds)->with('batch')->latest()->limit(5)->get();

        $recent = collect()
            ->merge($recordings->map(fn (Recording $item) => [
                'id' => $item->id,
                'title' => $item->title,
                'detail' => ($item->batch?->title ?? 'Batch').' · recording',
                'status' => $item->isReleased() ? 'Released' : 'Not released',
                'type' => 'recording',
                'sort' => $item->created_at,
            ]))
            ->merge($resources->map(fn (Resource $item) => [
                'id' => $item->id,
                'title' => $item->title,
                'detail' => ($item->batch?->title ?? 'Batch').' · resource',
                'status' => $item->isReleased() ? 'Released' : 'Not released',
                'type' => 'resource',
                'sort' => $item->created_at,
            ]))
            ->merge($tests->map(fn (Test $item) => [
                'id' => $item->id,
                'title' => $item->title,
                'detail' => ($item->batch?->title ?? 'Batch').' · assessment',
                'status' => ucfirst($item->status->value),
                'type' => 'test',
                'sort' => $item->created_at,
            ]))
            ->merge($announcements->map(fn (Announcement $item) => [
                'id' => $item->id,
                'title' => $item->title,
                'detail' => ($item->batch?->title ?? 'Batch').' · announcement',
                'status' => ucfirst($item->status->value),
                'type' => 'announcement',
                'sort' => $item->created_at,
            ]))
            ->sortByDesc('sort')
            ->take(12)
            ->map(fn (array $item) => collect($item)->except('sort')->all())
            ->values();

        $batches = Batch::query()
            ->whereIn('id', $batchIds)
            ->with('course:id,title')
            ->withCount(['enrollments as students_count' => fn ($query) => $query->accessible()])
            ->get();

        $nextSessions = $this->nextSessionsFor($batchIds);
        $syllabusPercents = $this->syllabusProgressFor($batchIds);

        return ApiResponse::item([
            'metrics' => [
                'recordings' => Recording::whereIn('batch_id', $batchIds)->count(),
                'resources' => Resource::whereIn('batch_id', $batchIds)->count(),
                'tests' => Test::whereIn('batch_id', $batchIds)->count(),
                'announcements' => Announcement::whereIn('batch_id', $batchIds)->count(),
            ],
            'recent' => $recent->all(),
            'batches' => $batches->map(fn (Batch $batch) => $this->batchPayload(
                $batch,
                $nextSessions->get($batch->id, false),
                $syllabusPercents[$batch->id] ?? 0,
            ))->all(),
        ]);
    }
}
