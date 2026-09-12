<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Account profile and the active-session list shown on the security screen.
 */
class ProfileController extends Controller
{
    public function __construct(
        protected SettingsRepository $settings,
        protected AuditLogger $audit,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        return ApiResponse::item([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'mobile' => $user->mobile,
            'identity_code' => $user->student_code ?? $user->staff_code,
            'avatar_url' => $user->avatarUrl(),
            'locale' => $user->locale === 'ne' ? 'ne' : 'en',
            'two_factor_enabled' => $user->hasTwoFactorEnabled(),
            'two_factor_required' => $this->settings->bool('security.privileged_mfa', true) && ! $user->hasRole('student'),
            'sessions' => $this->sessions($request),
        ])->header('Cache-Control', 'no-store, private');
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:120'],
            'email' => ['sometimes', 'nullable', 'email:filter', 'max:190', Rule::unique('users', 'email')->ignore($user->getKey())->whereNull('deleted_at')],
            'mobile' => ['sometimes', 'nullable', 'string', 'max:20', 'regex:/^[0-9+\-\s]+$/', Rule::unique('users', 'mobile')->ignore($user->getKey())->whereNull('deleted_at')],
            'locale' => ['sometimes', Rule::in(['en', 'ne'])],
        ]);

        // Changing the email invalidates verification; the session then carries
        // a verify_email required action until it is confirmed again.
        //
        // email_verified_at is intentionally not fillable — a request body must
        // never be able to mark an address verified — so it is written directly
        // rather than through fill(), which would silently drop it and leave the
        // new address reading as already verified.
        $emailChanged = array_key_exists('email', $data) && $data['email'] !== $user->email;

        $user->fill($data);

        if ($emailChanged) {
            $user->forceFill(['email_verified_at' => null]);
        }

        $user->save();
        $this->audit->log('account.profile_updated', $user, $user, properties: ['fields' => array_keys($data)]);

        return $this->show($request);
    }

    /** Every role reaches this through the same /api/v1/account/avatar routes. */
    public function uploadAvatar(Request $request): JsonResponse
    {
        $user = $request->user();
        $maxKb = (int) config('lms.uploads.image_max_kb', 2048);

        $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.$maxKb],
        ]);

        $previous = $user->avatar_path;
        $path = $request->file('avatar')->store('avatars', 'public');

        $user->forceFill(['avatar_path' => $path])->save();

        if ($previous) {
            Storage::disk('public')->delete($previous);
        }

        $this->audit->log('account.avatar_updated', $user, $user);

        return ApiResponse::item(['avatar_url' => $user->avatarUrl()]);
    }

    public function deleteAvatar(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
            $user->forceFill(['avatar_path' => null])->save();
            $this->audit->log('account.avatar_removed', $user, $user);
        }

        return ApiResponse::message('Photo removed.');
    }

    /**
     * Reads the database session store directly: there is no Eloquent model,
     * and the payload only needs a coarse device description.
     */
    protected function sessions(Request $request): array
    {
        if (config('session.driver') !== 'database') {
            return [];
        }

        return DB::table(config('session.table', 'sessions'))
            ->where('user_id', $request->user()->getKey())
            ->orderByDesc('last_activity')
            ->limit(20)
            ->get()
            ->map(fn ($session) => [
                'id' => $session->id,
                'device' => $this->deviceFrom($session->user_agent),
                'browser' => $this->browserFrom($session->user_agent),
                'platform' => $this->platformFrom($session->user_agent),
                'location' => $session->ip_address,
                'last_active_at' => now()->parse('@'.$session->last_activity)->toIso8601String(),
                // A token-authenticated (mobile) request has no session store
                // at all, so it can never be "the current session" in this
                // list — asking for its session ID unconditionally crashed
                // the whole profile endpoint for every mobile user.
                'current' => $request->hasSession() && $session->id === $request->session()->getId(),
            ])
            ->all();
    }

    protected function deviceFrom(?string $agent): string
    {
        return str_contains(strtolower((string) $agent), 'mobile') ? 'Mobile' : 'Desktop';
    }

    protected function browserFrom(?string $agent): string
    {
        $agent = strtolower((string) $agent);

        return match (true) {
            str_contains($agent, 'edg/') => 'Edge',
            str_contains($agent, 'chrome') => 'Chrome',
            str_contains($agent, 'firefox') => 'Firefox',
            str_contains($agent, 'safari') => 'Safari',
            default => 'Unknown browser',
        };
    }

    protected function platformFrom(?string $agent): string
    {
        $agent = strtolower((string) $agent);

        return match (true) {
            str_contains($agent, 'windows') => 'Windows',
            str_contains($agent, 'android') => 'Android',
            str_contains($agent, 'iphone'), str_contains($agent, 'ipad') => 'iOS',
            str_contains($agent, 'mac os') => 'macOS',
            str_contains($agent, 'linux') => 'Linux',
            default => 'Unknown platform',
        };
    }
}
