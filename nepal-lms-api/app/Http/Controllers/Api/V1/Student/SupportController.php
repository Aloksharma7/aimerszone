<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Enums\SupportTicketStatus;
use App\Models\Faq;
use App\Models\SupportTicket;
use App\Exceptions\DomainException;
use App\Services\FeatureGate;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SupportController extends Controller
{
    public function __construct(
        protected SettingsRepository $settings,
        protected FeatureGate $features,
    ) {}

    public function overview(Request $request): JsonResponse
    {
        $institution = $this->settings->group('institution');

        $tickets = SupportTicket::query()
            ->where('user_id', $request->user()->getKey())
            ->withCount(['messages as staff_reply_count' => fn ($query) => $query
                ->where('is_internal', false)
                ->whereColumn('author_id', '!=', 'support_tickets.user_id')])
            ->orderByDesc('updated_at')
            ->limit(20)
            ->get();

        /*
         * The ticket form has a "related course" selector that reads this.
         * It was never in the payload, so the frontend mapped `undefined` and
         * .map() threw — the support page did not render at all against a real
         * API.
         */
        $courses = $request->user()->enrollments()
            ->accessible()
            ->with('course:id,title')
            ->get()
            ->map(fn ($enrollment) => [
                'id' => $enrollment->id,
                'title' => $enrollment->course?->title ?? 'Course removed',
            ])
            ->values();

        return ApiResponse::item([
            'courses' => $courses->all(),
            'contact' => [
                'phone' => $institution['primary_phone'] ?? null,
                'whatsapp' => $institution['whatsapp'] ?? null,
                'email' => $institution['support_email'] ?? null,
                'hours' => $institution['support_hours'] ?? null,
            ],
            'faqs' => Faq::published()->limit(10)->get()->map(fn (Faq $faq) => [
                'id' => $faq->id,
                'question' => $faq->question,
                'answer' => $faq->answer,
            ])->all(),
            'tickets' => $tickets->map(fn (SupportTicket $ticket) => [
                'id' => $ticket->id,
                'reference' => $ticket->reference,
                'subject' => $ticket->subject,
                'status' => $ticket->status->value,
                'created_at' => $ticket->created_at->toIso8601String(),
                'resolved_at' => $ticket->resolved_at?->toIso8601String(),

                /*
                 * Whether anyone has answered, and when it last moved. Without
                 * these the list was a row of identical "Open" rows that never
                 * changed, which is indistinguishable from nobody reading it.
                 */
                'reply_count' => (int) $ticket->staff_reply_count,
                'updated_at' => $ticket->updated_at->toIso8601String(),
            ])->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->features->supportTickets()) {
            throw DomainException::conflict(
                'Support tickets are turned off. Please use the phone or WhatsApp number on the support page.',
                'support_tickets_disabled',
            );
        }

        $user = $request->user();

        $data = $request->validate([
            'subject' => ['required', 'string', 'max:180'],
            'category' => ['nullable', 'string', 'max:40'],
            'message' => ['required', 'string', 'min:10', 'max:4000'],

            // Must be one of the student's own enrollments — otherwise a
            // ticket could claim to be about a course this account never
            // touched.
            'enrollment_id' => ['nullable', 'string', Rule::exists('enrollments', 'id')->where('user_id', $user->getKey())],
        ]);

        $ticket = SupportTicket::create([
            'reference' => 'SUP-'.now()->format('Ymd').'-'.Str::upper(Str::random(5)),
            'user_id' => $user->getKey(),
            'enrollment_id' => $data['enrollment_id'] ?? null,
            'name' => $user->name,
            'email' => $user->email,
            'mobile' => $user->mobile,
            'subject' => $data['subject'],
            'category' => $data['category'] ?? 'general',
            'message' => $data['message'],
            'source' => 'student',
            'ip_address' => $request->ip(),

            // create() doesn't refetch the DB column default, so the in-memory
            // model's status was null right after this call — every
            // submission crashed reading ->status->value below.
            'status' => SupportTicketStatus::Open->value,
        ]);

        return ApiResponse::item([
            'id' => $ticket->id,
            'reference' => $ticket->reference,
            'status' => $ticket->status->value,
        ], status: 201);
    }
}
