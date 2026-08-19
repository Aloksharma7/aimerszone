<?php

namespace App\Http\Resources;

use App\Services\SettingsRepository;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The single source of truth the frontend uses for session, roles, permissions
 * and the required-action redirect.
 */
class AuthMeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'user' => (new UserSummaryResource($this->resource))->toArray($request),
            'roles' => $this->roleKeys()->values()->all(),
            'permissions' => $this->permissionKeys()->all(),
            'required_action' => $this->requiredAction(),
            'portal_home' => $this->portalHome(),
        ];
    }

    /**
     * Order matters: a forced password change is resolved before email
     * verification, and both before normal portal access.
     */
    protected function requiredAction(): ?string
    {
        if (session('two_factor.pending_user_id') !== null) {
            return 'two_factor_challenge';
        }

        if ($this->must_change_password) {
            return 'change_password';
        }

        $settings = app(SettingsRepository::class);

        if ($settings->bool('security.email_verification', false)
            && filled($this->email)
            && $this->email_verified_at === null) {
            return 'verify_email';
        }

        return null;
    }
}
