<?php

namespace App\Services;

use App\Enums\UserStatus;
use App\Exceptions\DomainException;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Identifier lookup, password check, progressive lockout and suspension
 * checks — shared by the web session login and the mobile token login so
 * this security-sensitive logic exists in exactly one place. Neither
 * controller decides "is this account allowed to sign in" on its own.
 */
class LoginAttemptService
{
    public function __construct(
        protected SettingsRepository $settings,
        protected AuditLogger $audit,
    ) {}

    /**
     * @throws ValidationException wrong identifier/password (identical message for both, so the
     *                              endpoint cannot be used to enumerate registered accounts)
     * @throws DomainException     locked or suspended account
     */
    public function verify(string $identifier, string $password): User
    {
        $identifier = trim($identifier);
        $user = User::query()
            ->where('email', mb_strtolower($identifier))
            ->orWhere('mobile', $identifier)
            ->orWhere('student_code', mb_strtoupper($identifier))
            ->first();

        if ($user === null || ! Hash::check($password, $user->password)) {
            $this->recordFailure($user);

            throw ValidationException::withMessages([
                'identifier' => 'These sign-in details do not match our records.',
            ]);
        }

        $this->assertSignInAllowed($user);

        return $user;
    }

    /**
     * The locked/suspended checks a password check would normally guard —
     * pulled out so a sign-in that authenticates a different way (Google)
     * still enforces them instead of skipping straight to a session.
     *
     * @throws DomainException locked or suspended account
     */
    public function assertSignInAllowed(User $user): void
    {
        if ($user->isLocked()) {
            throw DomainException::forbidden(
                'This account is temporarily locked. Try again after '.$user->locked_until->diffForHumans().'.',
                'account_locked',
            );
        }

        if ($user->status === UserStatus::Suspended) {
            $this->audit->log('auth.login_blocked_suspended', $user, $user);

            throw DomainException::forbidden('This account is suspended. Contact the institution office.', 'account_suspended');
        }
    }

    public function requiresTwoFactor(User $user): bool
    {
        if ($user->hasTwoFactorEnabled()) {
            return true;
        }

        return $this->settings->bool('security.privileged_mfa', true)
            && $user->hasTwoFactorEnabled()
            && ! $user->hasRole('student');
    }

    /** Unknown identifiers are ignored so no record is created for probes. */
    protected function recordFailure(?User $user): void
    {
        if ($user === null) {
            return;
        }

        $limit = $this->settings->int('security.failed_login_attempts', 5);
        $attempts = $user->failed_login_attempts + 1;

        $user->forceFill([
            'failed_login_attempts' => $attempts,
            'locked_until' => $attempts >= $limit
                ? now()->addMinutes($this->settings->int('security.lockout_minutes', 15))
                : $user->locked_until,
        ])->save();

        if ($attempts >= $limit) {
            $this->audit->log('auth.account_locked', $user, $user, 'Failed sign-in threshold reached');
        }
    }
}
