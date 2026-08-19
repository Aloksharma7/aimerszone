<?php

namespace App\Http\Controllers\Api\V1\Support;

use App\Enums\SupportTicketStatus;
use App\Http\Controllers\Controller;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\NotificationDispatcher;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The staff side of support.
 *
 * Students could raise a ticket from the first release; nothing could answer
 * one. A ticket sat at "Open" forever, with no reply, no status change and no
 * way for anyone to see the queue — the one place in the product where a user
 * does something and receives silence.
 */
class TicketController extends Controller
{
    public function __construct(
        protected AuditLogger $audit,
        protected NotificationDispatcher $notifications,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->string('search')->value());
        $status = trim((string) $request->string('status')->value());

        $tickets = SupportTicket::query()
            ->with(['user:id,name', 'assignee:id,name'])
            ->withCount('messages')
            ->when($status !== '', fn ($query) => $query->where('status', $status))
            ->when($request->filled('assigned_to'), fn ($query) => $query->where('assigned_to', $request->string('assigned_to')->value()))
            ->when($search !== '', function ($query) use ($search) {
                $like = '%'.addcslashes($search, '%_\\').'%';

                $query->where(function ($inner) use ($like) {
                    $inner->where('reference', 'like', $like)
                        ->orWhere('subject', 'like', $like)
                        ->orWhere('name', 'like', $like)
                        ->orWhere('email', 'like', $like)
                        ->orWhere('message', 'like', $like);
                });
            })

            // Open before pending before resolved, oldest first inside each —
            // so the ticket that has been waiting longest surfaces first
            // rather than the one raised most recently.
            ->orderByRaw("FIELD(status, 'open', 'pending', 'resolved', 'closed')")
            ->orderBy('created_at')
            ->limit($this->perPage(100))
            ->get();

        return ApiResponse::item([
            'items' => $tickets->map(fn (SupportTicket $ticket) => $this->summary($ticket))->all(),
            'metrics' => [
                'open' => SupportTicket::where('status', SupportTicketStatus::Open->value)->count(),
                'pending' => SupportTicket::where('status', SupportTicketStatus::Pending->value)->count(),
                'resolved_month' => SupportTicket::where('status', SupportTicketStatus::Resolved->value)
                    ->where('resolved_at', '>=', now()->startOfMonth())
                    ->count(),

                // Anything open and untouched for more than two days.
                'waiting_over_2_days' => SupportTicket::whereIn('status', [SupportTicketStatus::Open->value, SupportTicketStatus::Pending->value])
                    ->where('updated_at', '<', now()->subDays(2))
                    ->count(),
            ],
        ]);
    }

    public function show(Request $request, SupportTicket $ticket): JsonResponse
    {
        $this->authorize('view', $ticket);

        return ApiResponse::item($this->detail($request, $ticket));
    }

    /** Post a reply, optionally an internal note the student never sees. */
    public function reply(Request $request, SupportTicket $ticket): JsonResponse
    {
        $this->authorize('reply', $ticket);

        $data = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:4000'],
            'is_internal' => ['sometimes', 'boolean'],
            'status' => ['sometimes', Rule::in(SupportTicketStatus::values())],
        ]);

        $user = $request->user();

        // Only staff may write an internal note or move the status.
        $staff = $user->can('manage', $ticket);
        $internal = $staff && ($data['is_internal'] ?? false);

        $ticket = DB::transaction(function () use ($data, $internal, $staff, $ticket, $user) {
            $locked = SupportTicket::whereKey($ticket->getKey())->lockForUpdate()->firstOrFail();

            SupportTicketMessage::create([
                'support_ticket_id' => $locked->getKey(),
                'author_id' => $user->getKey(),
                'body' => $data['body'],
                'is_internal' => $internal,
            ]);

            /*
             * An internal note must not look like an answer.
             *
             * A staff reply moves the ticket to Pending (waiting on the
             * student); a student reply reopens it, because a resolved ticket
             * they are still writing on is not resolved.
             */
            $status = $data['status'] ?? null;

            if ($status === null && ! $internal) {
                $status = $staff
                    ? SupportTicketStatus::Pending->value
                    : SupportTicketStatus::Open->value;
            }

            if ($status !== null && $staff) {
                $locked->status = $status;
                $locked->resolved_at = in_array($status, ['resolved', 'closed'], true) ? now() : null;
            } elseif ($status !== null) {
                $locked->status = $status;
            }

            $locked->save();

            return $locked;
        });

        if ($staff && ! $internal) {
            $this->audit->log('support.replied', $ticket, $user);
            DB::afterCommit(fn () => $this->notifications->supportReplied($ticket->fresh()->load('user')));
        }

        return ApiResponse::item($this->detail($request, $ticket->fresh()));
    }

    /** Status, priority and assignment, without posting a message. */
    public function update(Request $request, SupportTicket $ticket): JsonResponse
    {
        $this->authorize('manage', $ticket);

        $data = $request->validate([
            'status' => ['sometimes', Rule::in(SupportTicketStatus::values())],
            'priority' => ['sometimes', Rule::in(['low', 'normal', 'high'])],
            'assigned_to' => ['sometimes', 'nullable', 'string', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'resolution_note' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);

        if (array_key_exists('status', $data)) {
            $ticket->resolved_at = in_array($data['status'], ['resolved', 'closed'], true) ? now() : null;
        }

        $ticket->fill($data)->save();

        $this->audit->log('support.updated', $ticket, $request->user(), properties: ['fields' => array_keys($data)]);

        return ApiResponse::item($this->detail($request, $ticket->fresh()));
    }

    /** Staff who can be assigned a ticket. */
    public function assignees(Request $request): JsonResponse
    {
        $users = User::query()
            ->whereHas('roles', fn ($role) => $role->whereIn('key', ['super_admin', 'admin', 'staff']))
            ->orderBy('name')
            ->get(['id', 'name']);

        return ApiResponse::collection($users->map(fn (User $user) => [
            'id' => $user->id,
            'name' => $user->name,
        ]));
    }

    protected function summary(SupportTicket $ticket): array
    {
        return [
            'id' => $ticket->id,
            'reference' => $ticket->reference,
            'subject' => $ticket->subject,
            'category' => $ticket->category,
            'status' => $ticket->status->value,
            'priority' => $ticket->priority ?? 'normal',
            'student_name' => $ticket->user?->name ?? $ticket->name,
            'assignee_name' => $ticket->assignee?->name,
            'message_count' => (int) ($ticket->messages_count ?? 0),
            'created_at' => $ticket->created_at->toIso8601String(),
            'updated_at' => $ticket->updated_at->toIso8601String(),
            'resolved_at' => $ticket->resolved_at?->toIso8601String(),
        ];
    }

    protected function detail(Request $request, SupportTicket $ticket): array
    {
        $ticket->loadMissing(['user:id,name', 'assignee:id,name', 'messages.author:id,name']);

        // A student must never receive an internal note, so it is filtered out
        // of the payload rather than hidden in the interface.
        $staff = $request->user()->can('manage', $ticket);

        $messages = $ticket->messages
            ->when(! $staff, fn ($items) => $items->where('is_internal', false))
            ->sortBy('created_at')
            ->values();

        return $this->summary($ticket) + [
            'message' => $ticket->message,
            'email' => $ticket->email,
            'mobile' => $ticket->mobile,
            'resolution_note' => $ticket->resolution_note,
            'can_manage' => $staff,
            'messages' => $messages->map(fn (SupportTicketMessage $item) => [
                'id' => $item->id,
                'body' => $item->body,
                'is_internal' => (bool) $item->is_internal,
                'author_name' => $item->author?->name ?? 'Removed account',
                'from_student' => $item->author_id === $ticket->user_id,
                'created_at' => $item->created_at->toIso8601String(),
            ])->all(),
        ];
    }
}
