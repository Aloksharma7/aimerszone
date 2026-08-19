<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmailVerificationController extends Controller
{
    public function send(Request $request): JsonResponse
    {
        $user = $request->user();

        if (blank($user->email)) {
            return ApiResponse::message('Add an email address to your profile before requesting verification.');
        }

        if ($user->email_verified_at !== null) {
            return ApiResponse::message('This email address is already verified.');
        }

        $user->sendEmailVerificationNotification();

        return ApiResponse::message('A verification link has been sent to your email address.');
    }
}
