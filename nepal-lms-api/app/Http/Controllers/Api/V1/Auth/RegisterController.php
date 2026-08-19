<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\AuthMeResource;
use App\Services\AuditLogger;
use App\Services\SettingsRepository;
use App\Services\UserDirectory;
use App\Support\ApiResponse;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;

class RegisterController extends Controller
{
    public function __construct(
        protected UserDirectory $directory,
        protected SettingsRepository $settings,
        protected AuditLogger $audit,
    ) {}

    public function __invoke(RegisterRequest $request): JsonResponse
    {
        $user = $this->directory->createStudent([
            'name' => $request->string('name')->trim()->value(),
            'mobile' => $request->string('mobile')->trim()->value(),
            'email' => $request->filled('email') ? $request->string('email')->lower()->trim()->value() : null,
            'password' => $request->string('password')->value(),
            'locale' => $request->input('preferred_language', 'en'),
            'terms_accepted' => true,
            'recording_policy_acknowledged' => $request->boolean('recording_policy_acknowledged'),
        ]);

        if (filled($user->email) && $this->settings->bool('security.email_verification', false)) {
            event(new Registered($user));
        }

        $this->audit->log('auth.registered', $user, $user);

        // Sign the new student in immediately: the frontend expects /auth/me to
        // resolve straight after registration.
        auth()->login($user, remember: false);
        $request->session()->regenerate();

        return ApiResponse::item(new AuthMeResource($user->fresh()), status: 201);
    }
}
