<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminAttentionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * The admin notification bell, reusing the same signals the dashboard's
 * "attention" panel already computes — outstanding decisions rather than
 * archived messages, so every item is always live (read is always false;
 * there is nothing to dismiss short of acting on it).
 */
class NotificationController extends Controller
{
    public function __construct(protected AdminAttentionService $attention) {}

    public function index(): JsonResponse
    {
        return ApiResponse::collection(collect($this->attention->items())->map(fn (array $item) => [
            'id' => $item['id'],
            'title' => $item['title'],
            'summary' => $item['detail'] ?? null,
            'published_at' => null,
            'read' => false,
            'href' => $item['href'] ?? null,
        ])->all());
    }
}
