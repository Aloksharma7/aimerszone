<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Read-only view of the audit trail. Entries are never editable. */
class AuditLogController extends Controller
{
    /**
     * Action prefixes behind each grouping offered in the filter bar.
     *
     * The UI offered these four groups plus a free-text box and an actor-role
     * selector, and none of them were read here — every filter combination
     * returned the same unfiltered page.
     */
    protected const ACTION_GROUPS = [
        'identity_access' => ['auth', 'user', 'role', 'account', 'teacher', 'student'],
        'payments' => ['payment', 'refund', 'adjustment', 'enrollment', 'enrollment_request'],
        'learning_operations' => ['class', 'attendance', 'recording', 'resource', 'test', 'attempt', 'batch', 'course', 'syllabus', 'category', 'announcement'],
        'settings' => ['setting', 'integration', 'feature', 'export'],
    ];

    public function index(Request $request): JsonResponse
    {
        $entries = $this->filtered($request)
            ->with('actor:id,name')
            ->orderByDesc('occurred_at')
            ->paginate($this->perPage(50));

        return ApiResponse::paginated($entries, fn (AuditLog $entry) => [
            'id' => $entry->id,
            'actor_label' => $entry->actor_label ?? $entry->actor?->name ?? 'System',
            'action' => $entry->action,
            'target_label' => $entry->target_label ?? '—',
            'occurred_at' => $entry->occurred_at->toIso8601String(),
            'reason' => $entry->reason,
        ]);
    }

    /**
     * Shared by the list and the CSV export, so an exported "filtered log" is
     * actually the filtered log.
     */
    public function filtered(Request $request)
    {
        $search = trim((string) $request->string('search')->value());
        $actorType = trim((string) $request->string('actor_type')->value());
        $group = trim((string) $request->string('action_group')->value());
        $prefixes = self::ACTION_GROUPS[$group] ?? null;

        return AuditLog::query()
            ->when($request->filled('action'), fn ($query) => $query->where('action', 'like', $request->string('action')->value().'%'))
            ->when($request->filled('actor_id'), fn ($query) => $query->where('actor_id', $request->string('actor_id')->value()))
            ->when($request->filled('from'), fn ($query) => $query->where('occurred_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($query) => $query->where('occurred_at', '<=', $request->date('to')))

            // Matches what the table actually shows, so a term visible on
            // screen is a term that finds the row.
            ->when($search !== '', function ($query) use ($search) {
                $like = '%'.addcslashes($search, '%_\\').'%';

                $query->where(function ($inner) use ($like) {
                    $inner->where('action', 'like', $like)
                        ->orWhere('actor_label', 'like', $like)
                        ->orWhere('target_label', 'like', $like)
                        ->orWhere('reason', 'like', $like)
                        ->orWhereHas('actor', fn ($actor) => $actor->where('name', 'like', $like)->orWhere('email', 'like', $like));
                });
            })
            ->when($actorType !== '', fn ($query) => $query->whereHas(
                'actor',
                fn ($actor) => $actor->whereHas('roles', fn ($role) => $role->where('key', $actorType)),
            ))
            ->when($prefixes !== null, fn ($query) => $query->where(function ($inner) use ($prefixes) {
                foreach ($prefixes as $prefix) {
                    $inner->orWhere('action', 'like', $prefix.'.%');
                }
            }));
    }
}
