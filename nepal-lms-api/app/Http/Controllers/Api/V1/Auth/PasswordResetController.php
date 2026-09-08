<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\AuthenticationRevoker;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class PasswordResetController extends Controller
{
    public function __construct(
        protected SettingsRepository $settings,
        protected AuditLogger $audit,
        protected AuthenticationRevoker $revoker,
    ) {}

    /**
     * Always answers with the same message whether or not the address exists,
     * so the endpoint cannot confirm which emails are registered.
     */
    public function forgot(Request $request): JsonResponse
    {
        /*
         * The sign-in form uses one `identifier` field for mobile or email, and
         * the forgot-password form reuses it. Only an email address can receive
         * a reset link, so a mobile number resolves to the account's email.
         */
        $request->validate([
            'identifier' => ['required_without:email', 'nullable', 'string', 'max:190'],
            'email' => ['required_without:identifier', 'nullable', 'email:filter', 'max:190'],
        ]);

        $identifier = trim((string) ($request->input('email') ?: $request->input('identifier')));

        $email = filter_var($identifier, FILTER_VALIDATE_EMAIL)
            ? mb_strtolower($identifier)
            : User::query()
                ->where('mobile', $identifier)
                ->orWhere('student_code', mb_strtoupper($identifier))
                ->value('email');

        if (filled($email)) {
            Password::sendResetLink(['email' => $email]);
        }

        return ApiResponse::message('If that address matches an account, a reset link is on its way.');
    }

    public function reset(Request $request): JsonResponse
    {
        $minimum = $this->settings->int('security.password_min_length', 8);

        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email:filter'],
            'password' => ['required', 'confirmed', PasswordRule::min($minimum)->letters()->numbers()],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) use ($request) {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                    'must_change_password' => false,
                    'password_changed_at' => now(),
                    'failed_login_attempts' => 0,
                    'locked_until' => null,
                ])->save();

                // Any session or device token opened with the old password is
                // no longer trusted — this used to delete only database
                // session rows, leaving a mobile app's Sanctum token (or any
                // token-authenticated session) fully working after a reset
                // specifically meant to lock out whoever had the old
                // password. There's no "current" session to preserve here
                // (this request isn't authenticated as the user at all), so
                // every credential goes.
                $this->revoker->revokeOthers($request, $user);

                event(new PasswordReset($user));
                $this->audit->log('auth.password_reset', $user, $user);
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => 'This reset link is invalid or has expired. Request a new one.',
            ]);
        }

        return ApiResponse::message('Your password has been reset. You can now sign in.');
    }
}
