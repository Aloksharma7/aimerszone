<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuthMeResource;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Called server-side by every protected Next.js layout. Must stay cheap and
 * must never be cached.
 */
class MeController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user()->load('roles.permissions:id,key');

        return ApiResponse::item(new AuthMeResource($user))
            ->header('Cache-Control', 'no-store, private');
    }
}
