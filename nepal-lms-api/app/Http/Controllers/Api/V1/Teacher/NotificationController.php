<?php

namespace App\Http\Controllers\Api\V1\Teacher;

use App\Http\Controllers\Controller;
use App\Services\AccessGuard;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The teacher notification bell, reusing the same follow-up signals the
 * dashboard already computes (pending attendance, unreleased recordings,
 * draft tests) — outstanding work rather than archived messages, so every
 * item is always live (read is always false).
 */
class NotificationController extends Controller
{
    use ResolvesTeacherScope;

    public function __construct(protected AccessGuard $guard) {}

    public function index(Request $request): JsonResponse
    {
        $batchIds = $this->guard->taughtBatchIds($request->user());

        return ApiResponse::collection(collect($this->followUps($batchIds))->map(fn (array $item) => [
            'id' => $item['id'],
            'title' => $item['title'],
            'summary' => $item['detail'] ?? null,
            'published_at' => null,
            'read' => false,
            'href' => $item['href'] ?? null,
        ])->all());
    }
}
