<?php

namespace App\Http\Controllers\Api\V1\Staff;

use App\Http\Controllers\Controller;
use App\Enums\SupportTicketStatus;
use App\Models\Announcement;
use App\Models\Payment;
use App\Models\SupportTicket;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * The staff notification bell — outstanding work for the merged
 * enrollment-and-accounting role (every such item always live, read is
 * always false; there is nothing to dismiss short of acting on it),
 * combined with any institution-wide or staff-targeted announcement, which
 * previously reached nobody outside the student portal at all.
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
                'href' => '/staff/payments?status=pending',
            ];
        }

        // "Open" specifically means the ball is in staff's court — set on
        // creation and put back here by a student's own reply (see
        // Support\TicketController::reply()). Until now nothing surfaced
        // that anywhere staff would actually see it: a student replying, or
        // opening a brand new ticket, produced no notification of any kind,
        // the mirror image of the (already fixed) gap on the student side.
        $openTickets = SupportTicket::query()->where('status', SupportTicketStatus::Open->value)->count();

        if ($openTickets > 0) {
            $oldestTicket = SupportTicket::query()->where('status', SupportTicketStatus::Open->value)->min('updated_at');

            $items[] = [
                'id' => 'tickets-awaiting-reply',
                'title' => $openTickets.' support ticket'.($openTickets === 1 ? '' : 's').' awaiting a reply',
                'summary' => $oldestTicket ? 'Oldest waiting since '.now()->parse($oldestTicket)->diffForHumans() : null,
                'published_at' => null,
                'read' => false,
                'href' => '/staff/support?status=open',
            ];
        }

        $announcements = Announcement::query()
            ->published()
            ->forRole('staff')
            ->orderByDesc('published_at')
            ->limit(20)
            ->get()
            ->map(fn (Announcement $announcement) => [
                'id' => $announcement->id,
                'title' => $announcement->title,
                'summary' => $announcement->summary,
                'published_at' => $announcement->published_at?->toIso8601String(),
                'read' => false,
                'href' => $announcement->link,
            ])
            ->all();

        return ApiResponse::collection([...$items, ...$announcements]);
    }
}
