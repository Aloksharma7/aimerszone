<?php

namespace App\Http\Controllers\Api\V1\Staff;

use App\Http\Controllers\Controller;
use App\Models\EnrollmentRequest;
use App\Models\Payment;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * The staff notification bell — outstanding work for the merged
 * enrollment-and-accounting role, so every item is always live (read is
 * always false; there is nothing to dismiss short of acting on it).
 */
class NotificationController extends Controller
{
    public function index(): JsonResponse
    {
        $items = [];

        $pendingPayments = Payment::query()->pendingReview()->count();

        if ($pendingPayments > 0) {
            $oldest = Payment::query()->pendingReview()->min('submitted_at');

            $items[] = [
                'id' => 'payment-pending',
                'title' => $pendingPayments.' payment'.($pendingPayments === 1 ? '' : 's').' pending review',
                'summary' => $oldest ? 'Oldest submission '.now()->parse($oldest)->diffForHumans() : null,
                'published_at' => null,
                'read' => false,
                'href' => '/accounting/payments',
            ];
        }

        $pendingRequests = EnrollmentRequest::query()->where('status', 'pending')->count();

        if ($pendingRequests > 0) {
            $items[] = [
                'id' => 'enrollment-requests-pending',
                'title' => $pendingRequests.' enrollment request'.($pendingRequests === 1 ? '' : 's').' waiting on a decision',
                'summary' => 'Scholarship, transfer and exception requests only an admin can decide.',
                'published_at' => null,
                'read' => false,
                'href' => '/staff/enrollments',
            ];
        }

        return ApiResponse::collection($items);
    }
}
