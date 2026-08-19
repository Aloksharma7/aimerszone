<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Http\Resources\AnnouncementResource;
use App\Models\Announcement;
use App\Services\AccessGuard;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The notifications feed and the institution announcement list are the same
 * data with different framing; both are filtered to what this student is
 * actually addressed by.
 */
class NotificationController extends Controller
{
    public function __construct(protected AccessGuard $guard) {}

    public function index(Request $request): JsonResponse
    {
        return ApiResponse::collection($this->feed($request, markable: true));
    }

    public function announcements(Request $request): JsonResponse
    {
        return ApiResponse::collection($this->feed($request, markable: false));
    }

    public function markRead(Request $request, Announcement $announcement): JsonResponse
    {
        // Only announcements the student can actually see may be marked read.
        abort_unless($this->visibleIds($request)->contains($announcement->getKey()), 404);

        DB::table('announcement_reads')->updateOrInsert(
            ['announcement_id' => $announcement->getKey(), 'user_id' => $request->user()->getKey()],
            ['read_at' => now()],
        );

        return ApiResponse::item(['read' => true]);
    }

    protected function feed(Request $request, bool $markable)
    {
        $user = $request->user();
        $batchIds = $this->guard->accessibleBatchIds($user);
        $courseIds = $user->enrollments()->accessible()->pluck('course_id')->all();

        $announcements = Announcement::query()
            ->published()
            ->forStudent($batchIds, $courseIds)
            ->with(['course:id,title', 'batch.course:id,title'])
            ->orderByDesc('pinned')
            ->orderByDesc('published_at')
            ->limit(50)
            ->get();

        $read = DB::table('announcement_reads')
            ->where('user_id', $user->getKey())
            ->whereIn('announcement_id', $announcements->pluck('id'))
            ->pluck('announcement_id')
            ->flip();

        return $announcements->map(fn (Announcement $announcement) => (new AnnouncementResource($announcement))
            ->additional(['read' => $read->has($announcement->id)])
            ->toArray($request));
    }

    protected function visibleIds(Request $request)
    {
        $user = $request->user();

        return Announcement::query()
            ->published()
            ->forStudent(
                $this->guard->accessibleBatchIds($user),
                $user->enrollments()->accessible()->pluck('course_id')->all(),
            )
            ->pluck('id');
    }
}
