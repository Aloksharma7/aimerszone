<?php

namespace App\Http\Controllers\Api\V1\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Services\AccessGuard;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The teacher notification bell, combining the same follow-up signals the
 * dashboard already computes (pending attendance, unreleased recordings,
 * draft tests — outstanding work, so always shown as unread) with any
 * institution-wide or teacher-targeted announcement, which previously
 * reached nobody outside the student portal at all.
 */
class NotificationController extends Controller
{
    use ResolvesTeacherScope;

    public function __construct(protected AccessGuard $guard) {}

    public function index(Request $request): JsonResponse
    {
        $batchIds = $this->guard->taughtBatchIds($request->user());

        $followUps = collect($this->followUps($batchIds))->map(fn (array $item) => [
            'id' => $item['id'],
            'title' => $item['title'],
            'summary' => $item['detail'] ?? null,
            'published_at' => null,
            'read' => false,
            'href' => $item['href'] ?? null,
        ]);

        $announcements = Announcement::query()
            ->published()
            ->forRole('teacher')
            ->orderByDesc('published_at')
            ->limit(20)
            ->get()
            ->map(fn (Announcement $announcement) => [
                'id' => $announcement->id,
                'title' => $announcement->title,
                'summary' => $announcement->summary,
                'published_at' => $announcement->published_at?->toIso8601String(),
                'read' => false,
                'href' => $announcement->link,
            ]);

        return ApiResponse::collection($followUps->concat($announcements)->all());
    }
}
