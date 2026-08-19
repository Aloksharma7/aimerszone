<?php

namespace App\Http\Controllers\Api\V1\Teacher;

use App\Enums\AnnouncementAudience;
use App\Enums\AnnouncementStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\AnnouncementResource;
use App\Models\Announcement;
use App\Services\AccessGuard;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Teachers may only address batches they teach, which is enforced here rather
 * than trusted from the batch_id in the request.
 */
class AnnouncementController extends Controller
{
    use ResolvesTeacherScope;

    public function __construct(
        protected AccessGuard $guard,
        protected AuditLogger $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $announcements = Announcement::query()
            ->whereIn('batch_id', $this->guard->taughtBatchIds($request->user()) ?: ['-'])
            ->with(['course:id,title', 'batch.course:id,title'])
            ->orderByDesc('published_at')
            ->paginate($this->perPage(100));

        return ApiResponse::paginated($announcements, fn (Announcement $announcement) => (new AnnouncementResource($announcement))->toArray($request));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'batch_id' => ['required', 'string'],
            'title' => ['required', 'string', 'min:3', 'max:180'],
            'body' => ['required', 'string', 'min:10', 'max:20000'],
            'pinned' => ['nullable', 'boolean'],
        ]);

        $batch = $this->resolveBatch($data['batch_id'], $request->user());

        $announcement = Announcement::create([
            'title' => $data['title'],
            'summary' => \Illuminate\Support\Str::limit(strip_tags($data['body']), 200),
            'body' => $data['body'],
            'audience' => AnnouncementAudience::Batch->value,
            'batch_id' => $batch->getKey(),
            'course_id' => $batch->course_id,
            'channel' => 'portal',
            'status' => AnnouncementStatus::Published->value,
            'published_at' => now(),
            'pinned' => (bool) ($data['pinned'] ?? false),
            'created_by' => $request->user()->getKey(),
        ]);

        $this->audit->log('announcement.published', $announcement, $request->user(), properties: [
            'batch_id' => $batch->getKey(),
        ]);

        return ApiResponse::item(['id' => $announcement->id], status: 201);
    }
}
