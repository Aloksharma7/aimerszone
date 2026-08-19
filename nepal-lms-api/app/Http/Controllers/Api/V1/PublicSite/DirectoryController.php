<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Controller;
use App\Http\Resources\FaqResource;
use App\Http\Resources\TeacherResource;
use App\Models\Faq;
use App\Models\TeacherProfile;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class DirectoryController extends Controller
{
    public function teachers(): JsonResponse
    {
        $teachers = TeacherProfile::public()
            ->with('user:id,name')
            ->orderBy('sort_order')
            ->get();

        return ApiResponse::collection(TeacherResource::collection($teachers));
    }

    public function faqs(): JsonResponse
    {
        return ApiResponse::collection(FaqResource::collection(Faq::published()->get()));
    }
}
