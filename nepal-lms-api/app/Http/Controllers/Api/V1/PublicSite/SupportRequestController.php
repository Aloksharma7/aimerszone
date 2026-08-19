<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Controller;
use App\Enums\SupportTicketStatus;
use App\Models\SupportTicket;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Public contact form. Rate limited, and the stored record is treated as
 * untrusted input: it is escaped on read and never rendered as HTML.
 */
class SupportRequestController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['nullable', 'email:filter', 'max:190'],
            'mobile' => ['nullable', 'string', 'max:20'],
            'subject' => ['required', 'string', 'max:180'],
            'category' => ['nullable', 'string', 'max:40'],
            'message' => ['required', 'string', 'min:10', 'max:4000'],
        ]);

        if (blank($data['email'] ?? null) && blank($data['mobile'] ?? null)) {
            return ApiResponse::error(
                'Provide an email address or a mobile number so we can reply.',
                'validation_failed',
                422,
                ['email' => ['Provide an email address or a mobile number.']],
            );
        }

        $ticket = SupportTicket::create([
            'reference' => 'SUP-'.now()->format('Ymd').'-'.Str::upper(Str::random(5)),
            'user_id' => $request->user()?->getKey(),
            'name' => $data['name'],
            'email' => $data['email'] ?? null,
            'mobile' => $data['mobile'] ?? null,
            'subject' => $data['subject'],
            'category' => $data['category'] ?? 'general',
            'message' => $data['message'],
            'source' => $request->user() ? 'student' : 'public',
            'ip_address' => $request->ip(),

            // create() doesn't refetch the DB column default, so the in-memory
            // model's status was null right after this call — every
            // submission crashed reading ->status->value below.
            'status' => SupportTicketStatus::Open->value,
        ]);

        return ApiResponse::item([
            'reference' => $ticket->reference,
            'status' => $ticket->status->value,
        ], status: 201);
    }
}
