<?php

namespace App\Services;

use App\Exceptions\DomainException;
use App\Models\DeviceSession;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Binds an account to the device it signs in from.
 *
 * The rule only applies to students: a teacher marking attendance on a tablet
 * while their laptop is open is normal, whereas a student signed in from four
 * places usually means one purchase serving four people.
 *
 * When the limit is reached the newest sign-in is refused rather than silently
 * kicking out the existing device. Bumping the old session would let someone
 * who guessed a password quietly displace the real owner, and a student who
 * genuinely changed phone gets a clear message and a support path instead of a
 * mysterious logout.
 */
class DeviceGuard
{
    public function __construct(
        protected SettingsRepository $settings,
        protected FeatureGate $features,
        protected AuditLogger $audit,
    ) {}

    /**
     * Called immediately after credentials pass, before the session is issued.
     *
     * @throws DomainException when the account is already on its device limit.
     */
    public function register(User $user, Request $request): ?DeviceSession
    {
        if (! $this->appliesTo($user)) {
            return null;
        }

        $hash = $this->fingerprint($request);
        $limit = max(1, $user->device_limit ?? 1);

        return DB::transaction(function () use ($user, $request, $hash, $limit) {
            $existing = DeviceSession::query()
                ->where('user_id', $user->getKey())
                ->where('device_hash', $hash)
                ->lockForUpdate()
                ->first();

            // A returning device is always welcome, even a previously revoked
            // one: revocation frees the slot, it does not blacklist the phone.
            if ($existing !== null) {
                $existing->forceFill([
                    'revoked_at' => null,
                    'revoked_reason' => null,
                    'ip_address' => $request->ip(),
                    'session_id' => $request->session()->getId(),
                    'last_active_at' => now(),
                ])->save();

                return $existing;
            }

            $active = DeviceSession::query()
                ->where('user_id', $user->getKey())
                ->active()
                ->lockForUpdate()
                ->count();

            if ($active >= $limit) {
                $this->audit->log('auth.device_limit_reached', $user, $user, properties: [
                    'limit' => $limit,
                    'ip' => $request->ip(),
                ]);

                throw DomainException::forbidden(
                    $limit === 1
                        ? 'This account is already signed in on another device. Sign out there first, or contact the institution office to reset it.'
                        : "This account is already signed in on {$limit} devices. Sign out on one of them first.",
                    'device_limit_reached',
                );
            }

            return DeviceSession::create([
                'user_id' => $user->getKey(),
                'device_hash' => $hash,
                'label' => $this->label($request),
                'platform' => $this->platform($request),
                'browser' => $this->browser($request),
                'ip_address' => $request->ip(),
                'session_id' => $request->session()->getId(),
                'last_active_at' => now(),
            ]);
        });
    }

    /** Frees the slot when the student signs out normally. */
    public function releaseCurrent(User $user, Request $request): void
    {
        DeviceSession::query()
            ->where('user_id', $user->getKey())
            ->where('device_hash', $this->fingerprint($request))
            ->update(['revoked_at' => now(), 'revoked_reason' => 'signed_out']);
    }

    /** Administrator or office action when a student changes phone. */
    public function releaseAll(User $user, string $reason = 'reset_by_staff'): int
    {
        return DeviceSession::query()
            ->where('user_id', $user->getKey())
            ->active()
            ->update(['revoked_at' => now(), 'revoked_reason' => $reason]);
    }

    public function touch(User $user, Request $request): void
    {
        if (! $this->appliesTo($user)) {
            return;
        }

        DeviceSession::query()
            ->where('user_id', $user->getKey())
            ->where('device_hash', $this->fingerprint($request))
            ->where(fn ($query) => $query->whereNull('last_active_at')->orWhere('last_active_at', '<', now()->subMinutes(5)))
            ->update(['last_active_at' => now()]);
    }

    /** @return array<int, array<string, mixed>> */
    public function listFor(User $user): array
    {
        return DeviceSession::query()
            ->where('user_id', $user->getKey())
            ->orderByDesc('last_active_at')
            ->get()
            ->map(fn (DeviceSession $device) => [
                'id' => $device->id,
                'label' => $device->label ?? 'Unknown device',
                'platform' => $device->platform,
                'browser' => $device->browser,
                'last_active_at' => $device->last_active_at?->toIso8601String(),
                'active' => $device->isActive(),
            ])
            ->all();
    }

    protected function appliesTo(User $user): bool
    {
        // Staff work across devices as a matter of course; the control exists
        // to stop one purchased seat serving a study group.
        return $this->features->singleDeviceLogin()
            && $user->hasRole('student')
            && ! $user->isAdmin();
    }

    /**
     * A stable-enough identifier for one browser or app install.
     *
     * The client sends X-Device-Id, which the frontend persists. IP is
     * deliberately excluded — a student moving between mobile data and wifi
     * must not read as a new device.
     */
    public function fingerprint(Request $request): string
    {
        $supplied = (string) $request->header('X-Device-Id', '');

        $material = filled($supplied) && preg_match('/^[A-Za-z0-9\-_]{8,120}$/', $supplied)
            ? $supplied
            : $this->platform($request).'|'.$this->browser($request).'|'.$request->userAgent();

        return hash('sha256', $material);
    }

    protected function label(Request $request): string
    {
        return trim($this->browser($request).' on '.$this->platform($request));
    }

    protected function platform(Request $request): string
    {
        $agent = strtolower((string) $request->userAgent());

        return match (true) {
            str_contains($agent, 'android') => 'Android',
            str_contains($agent, 'iphone'), str_contains($agent, 'ipad') => 'iOS',
            str_contains($agent, 'windows') => 'Windows',
            str_contains($agent, 'mac os') => 'macOS',
            str_contains($agent, 'linux') => 'Linux',
            default => 'Unknown',
        };
    }

    protected function browser(Request $request): string
    {
        $agent = strtolower((string) $request->userAgent());

        return match (true) {
            str_contains($agent, 'edg/') => 'Edge',
            str_contains($agent, 'chrome') => 'Chrome',
            str_contains($agent, 'firefox') => 'Firefox',
            str_contains($agent, 'safari') => 'Safari',
            default => 'Browser',
        };
    }
}
