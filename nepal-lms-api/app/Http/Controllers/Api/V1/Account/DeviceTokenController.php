<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Models\DeviceToken;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Registers this device for push notifications — any signed-in role, mobile
 * only (the web app has no equivalent). A token is globally unique: if it
 * reappears under a different account (shared device, account switch) it is
 * reassigned rather than duplicated, so a stale registration under the
 * previous user never lingers.
 */
class DeviceTokenController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'expo_push_token' => ['required', 'string', 'max:255'],
            'platform' => ['nullable', Rule::in(['ios', 'android'])],
        ]);

        DeviceToken::updateOrCreate(
            ['expo_push_token' => $data['expo_push_token']],
            ['user_id' => $request->user()->getKey(), 'platform' => $data['platform'] ?? null],
        );

        return ApiResponse::item(['registered' => true], status: 201);
    }

    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate(['expo_push_token' => ['required', 'string', 'max:255']]);

        DeviceToken::where('user_id', $request->user()->getKey())
            ->where('expo_push_token', $data['expo_push_token'])
            ->delete();

        return ApiResponse::item(['removed' => true]);
    }
}
