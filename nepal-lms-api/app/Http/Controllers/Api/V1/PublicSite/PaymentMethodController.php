<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicPaymentMethodResource;
use App\Models\PaymentMethod;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/** Backs /payment-instructions. Only active methods are published. */
class PaymentMethodController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $methods = PaymentMethod::active()->get();

        return ApiResponse::collection(PublicPaymentMethodResource::collection($methods));
    }
}
