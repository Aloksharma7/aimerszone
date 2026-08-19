<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Http\Resources\ResourceFileResource;
use App\Models\Resource;
use App\Services\AccessGuard;
use App\Services\MediaLinkService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResourceController extends Controller
{
    public function __construct(
        protected AccessGuard $guard,
        protected MediaLinkService $links,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $batchIds = $this->guard->accessibleBatchIds($user);
        $courseIds = $user->enrollments()->accessible()->pluck('course_id')->all();

        $resources = Resource::query()
            ->released()
            ->where(fn ($query) => $query
                ->whereIn('batch_id', $batchIds ?: ['-'])
                ->orWhere(fn ($builder) => $builder->whereNull('batch_id')->whereIn('course_id', $courseIds ?: ['-']))
                ->orWhere('is_public', true))
            ->with(['batch.course', 'course'])
            ->when($request->filled('q'), fn ($query) => $query->where(
                'title',
                'like',
                // % and _ are LIKE wildcards: a student searching "50%" would
                // otherwise match every row.
                '%'.str_replace(['%', '_'], ['\%', '\_'], $request->string('q')->value()).'%',
            ))
            ->orderByDesc('released_at')
            ->paginate($this->perPage(24));

        $enrollmentByBatch = $user->enrollments()->accessible()->get()->keyBy('batch_id');

        return ApiResponse::paginated($resources, fn (Resource $resource) => (new ResourceFileResource($resource))
            ->additional(['enrollment_id' => $enrollmentByBatch[$resource->batch_id]->id ?? null])
            ->toArray($request));
    }

    /**
     * Issues a signed download link. The link itself re-checks the policy when
     * opened, so it cannot be forwarded to someone without access.
     */
    public function download(Request $request, Resource $resource): JsonResponse
    {
        $this->authorize('download', $resource);

        $destination = $this->links->forResource($resource);

        return ApiResponse::destination($destination['url'], $destination['expires_at'], [
            'filename' => $resource->title,
            'size_bytes' => $resource->size_bytes,
        ]);
    }
}
