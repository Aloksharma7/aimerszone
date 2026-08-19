<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use App\Support\RequestContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

/**
 * Append-only trail for privileged and money-touching actions.
 *
 * Writing an audit entry is part of the action, not an afterthought: approvals,
 * settings changes, role changes and account actions all record one inside the
 * same transaction as the change itself.
 */
class AuditLogger
{
    public function __construct(protected RequestContext $context) {}

    public function log(
        string $action,
        ?Model $target = null,
        ?User $actor = null,
        ?string $reason = null,
        array $properties = [],
        ?string $targetLabel = null,
    ): AuditLog {
        $actor ??= auth()->user();

        $entry = AuditLog::create([
            'actor_id' => $actor?->getKey(),
            'actor_label' => $actor ? $actor->name.' ('.($actor->primaryRoleKey()?->label() ?? 'user').')' : 'System',
            'action' => $action,
            'target_type' => $target ? class_basename($target) : null,
            'target_id' => $target?->getKey(),
            'target_label' => $targetLabel ?? $this->labelFor($target),
            'reason' => $reason,
            'properties' => $properties ?: null,
            'ip_address' => request()->ip(),
            'user_agent' => substr((string) request()->userAgent(), 0, 500),
            'request_id' => $this->context->requestId(),
            'occurred_at' => now(),
        ]);

        Log::channel('security')->info($action, [
            'audit_id' => $entry->getKey(),
            'actor_id' => $actor?->getKey(),
            'target' => $entry->target_type.':'.$entry->target_id,
            'request_id' => $entry->request_id,
        ]);

        return $entry;
    }

    protected function labelFor(?Model $target): ?string
    {
        if ($target === null) {
            return null;
        }

        foreach (['title', 'name', 'reference', 'number', 'topic', 'key'] as $attribute) {
            if (filled($target->getAttribute($attribute))) {
                return (string) $target->getAttribute($attribute);
            }
        }

        return class_basename($target).' '.$target->getKey();
    }
}
