<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\BatchStatus;
use App\Enums\RoleKey;
use App\Enums\UserStatus;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Enrollment;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\AuthenticationRevoker;
use App\Services\DeviceGuard;
use App\Services\UserDirectory;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Administrator user management.
 *
 * Accounts are never deleted: they are linked to payments, attendance and audit
 * history, so the destructive path is suspension. Every action here is audited
 * with the operational reason supplied by the administrator.
 */
class UserController extends Controller
{
    public function __construct(
        protected UserDirectory $directory,
        protected AuditLogger $audit,
        protected AuthenticationRevoker $revoker,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $users = User::query()
            ->with('roles:id,key,name')
            ->search($request->string('q')->value())
            ->when($request->filled('role'), fn ($query) => $query->withRole($request->string('role')->value()))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->orderBy('name')
            ->paginate($this->perPage());

        return ApiResponse::paginated($users, fn (User $user) => $this->summary($user));
    }

    public function show(User $user): JsonResponse
    {
        $user->load(['roles:id,key,name', 'enrollments.course:id,title', 'enrollments.batch:id,title']);

        return ApiResponse::item([
            'user' => array_merge($this->summary($user), [
                'student_code' => $user->student_code,
                'email_verified' => $user->email_verified_at !== null,
            ]),
            'metrics' => [
                'active_enrollments' => $user->enrollments->where('status', 'active')->count(),
                'approved_payments' => $user->payments()->approved()->count(),
                'learning_progress_percent' => (int) round($user->enrollments->avg('overall_percent') ?? 0),
                'last_sign_in_label' => $user->last_login_at?->toIso8601String() ?? 'Never',
            ],
            'enrollments' => $user->enrollments->map(fn ($enrollment) => [
                'id' => $enrollment->id,
                'course_title' => $enrollment->course?->title ?? 'Course',
                'batch_title' => $enrollment->batch?->title ?? 'Batch',
                'access_label' => $enrollment->access_end_at?->toIso8601String() ?? 'No expiry',
                'basis_label' => ucfirst($enrollment->source),
                'status' => $enrollment->status->value,
            ])->values()->all(),
            'activity' => $this->recentActivity($user),
        ]);
    }

    /**
     * Creates a staff account.
     *
     * Without this the institution could not be staffed at all: students arrive
     * through the enrollment office, but a teacher, accountant or officer could
     * only be made with tinker or a seeder.
     *
     * The administrator never chooses or sees a lasting password. Either a
     * reset link is sent, or a one-time temporary password is returned once and
     * the account is flagged to change it at first sign-in.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email:filter', 'max:190', Rule::unique('users', 'email')->whereNull('deleted_at')],
            'mobile' => ['nullable', 'string', 'min:7', 'max:20', 'regex:/^\+?[0-9\s-]+$/', Rule::unique('users', 'mobile')->whereNull('deleted_at')],
            'primary_role' => ['required', Rule::in(RoleKey::values())],
            'staff_code' => ['nullable', 'string', 'max:32', Rule::unique('users', 'staff_code')],
            'language' => ['nullable', Rule::in(['en', 'ne'])],
            'password_setup_method' => ['required', Rule::in(['link', 'temporary'])],
        ]);

        $role = RoleKey::from($data['primary_role']);
        $this->assertMayAssignRole($role, $request->user());
        $temporary = $data['password_setup_method'] === 'temporary' ? Str::password(14) : null;

        $user = DB::transaction(function () use ($data, $role, $temporary, $request) {
            $user = User::create([
                'name' => $data['name'],
                'email' => mb_strtolower($data['email']),
                'mobile' => $data['mobile'] ?? null,
                'password' => $temporary ?? Str::password(32),
                'locale' => $data['language'] ?? 'en',
                'status' => UserStatus::Active->value,
                'must_change_password' => true,
                'staff_code' => $data['staff_code'] ?? $this->nextStaffCode($role),
                'created_by' => $request->user()->getKey(),
            ]);

            // setPrimaryRole also issues a student code when the role is
            // student, so a student created here is not missing one.
            $this->directory->setPrimaryRole($user, $role, $request->user());

            return $user;
        });

        if ($data['password_setup_method'] === 'link') {
            Password::sendResetLink(['email' => $user->email]);
        }

        $this->audit->log('user.created', $user, $request->user(), properties: [
            'role' => $role->value,
            'setup' => $data['password_setup_method'],
        ]);

        return ApiResponse::item(array_filter([
            'id' => $user->id,
            'staff_code' => $user->staff_code,

            // Shown once, so the administrator can hand it over in person.
            // It is not recoverable afterwards.
            'temporary_password' => $temporary,
        ]), status: 201);
    }

    /**
     * Only Super Admin may grant admin-tier access. Without this, Admin's
     * ordinary users.manage permission (needed to run staff/teacher/student
     * accounts) would double as a way to create or promote its own peers.
     */
    protected function assertMayAssignRole(RoleKey $role, User $actor): void
    {
        if (in_array($role, [RoleKey::Admin, RoleKey::SuperAdmin], true) && ! $actor->isSuperAdmin()) {
            throw DomainException::forbidden(
                'Only a Super Admin can grant an Admin or Super Admin role.',
                'admin_role_assignment_blocked',
            );
        }
    }

    /** Sequential, readable code such as TEA-0007. */
    protected function nextStaffCode(RoleKey $role): ?string
    {
        if ($role === RoleKey::Student) {
            return null;
        }

        $prefix = Str::upper(Str::substr($role->value, 0, 3));

        $latest = User::withTrashed()
            ->where('staff_code', 'like', $prefix.'-%')
            ->orderByDesc('staff_code')
            ->value('staff_code');

        $sequence = $latest ? ((int) Str::afterLast($latest, '-')) + 1 : 1;

        return sprintf('%s-%04d', $prefix, $sequence);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:120'],
            'email' => ['sometimes', 'nullable', 'email:filter', 'max:190', Rule::unique('users', 'email')->ignore($user->getKey())->whereNull('deleted_at')],
            'mobile' => ['sometimes', 'nullable', 'string', 'max:20', Rule::unique('users', 'mobile')->ignore($user->getKey())->whereNull('deleted_at')],
            'primary_role' => ['sometimes', Rule::in(RoleKey::values())],
            'language' => ['sometimes', 'string', 'max:20'],
        ]);

        $actor = $request->user();
        $this->authorize('update', $user);

        if (isset($data['primary_role'])) {
            $this->assertMayAssignRole(RoleKey::from($data['primary_role']), $actor);
        }

        // An admin-tier user must not remove their own admin-tier role and
        // lock the institution out of its own settings.
        if (($data['primary_role'] ?? null) !== null
            && $user->is($actor)
            && $actor->isAdmin()
            && ! in_array($data['primary_role'], [RoleKey::Admin->value, RoleKey::SuperAdmin->value], true)) {
            return ApiResponse::error(
                'You cannot remove your own administrator role.',
                'self_demotion_blocked',
                409,
            );
        }

        DB::transaction(function () use ($data, $user, $actor) {
            $attributes = collect($data)->only(['name', 'email', 'mobile'])->all();

            if (isset($data['language'])) {
                $attributes['locale'] = str_starts_with(strtolower($data['language']), 'nep') ? 'ne' : 'en';
            }

            $user->fill($attributes)->save();

            if (isset($data['primary_role'])) {
                $this->directory->setPrimaryRole($user, $data['primary_role'], $actor);
            }
        });

        $this->audit->log('user.updated', $user, $actor, properties: ['fields' => array_keys($data)]);

        return ApiResponse::item(['id' => $user->id]);
    }

    /**
     * High-impact account actions: password-reset, revoke-sessions,
     * mfa-reset, suspend, reactivate.
     */
    public function action(Request $request, User $user, string $action): JsonResponse
    {
        $this->authorize('administer', $user);

        $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $reason = $request->string('reason')->trim()->value() ?: null;
        $actor = $request->user();

        if (in_array($action, ['suspend', 'mfa-reset'], true) && $user->is($actor)) {
            return ApiResponse::error('This action cannot be applied to your own account.', 'self_action_blocked', 409);
        }

        if (in_array($action, ['suspend', 'reactivate', 'mfa-reset'], true) && $reason === null) {
            return ApiResponse::error(
                'An operational reason is required for this action.',
                'reason_required',
                422,
                ['reason' => ['Provide the reason recorded in the audit log.']],
            );
        }

        // Suspend produces the exact same immediate access loss as Archive
        // (EnsureAccountIsUsable blocks every request the instant status
        // isn't Active) but, unlike Archive, had none of its safeguards — a
        // paying student mid-course could be cut off with no warning via the
        // button sitting right next to the properly-guarded one.
        if ($action === 'suspend') {
            $active = Enrollment::query()->where('user_id', $user->getKey())->accessible()->count();

            if ($active > 0) {
                throw DomainException::conflict(
                    "This account has {$active} course".($active === 1 ? '' : 's')
                        .' with active access. End or transfer the enrolment first, so the student is not cut off without a record of why.',
                    'user_has_active_access',
                );
            }

            $this->assertArchivingDoesNotOrphanABatch($user);
        }

        $status = match ($action) {
            'password-reset' => $this->sendPasswordReset($user),
            'revoke-sessions' => $this->revokeSessions($request, $user),
            'mfa-reset' => $this->resetMfa($request, $user),
            'suspend' => $this->setStatus($request, $user, UserStatus::Suspended),
            'reactivate' => $this->setStatus($request, $user, UserStatus::Active),
            default => null,
        };

        if ($status === null) {
            return ApiResponse::error('That account action is not supported.', 'unsupported_action', 422);
        }

        $this->audit->log('user.'.str_replace('-', '_', $action), $user, $actor, $reason);

        return ApiResponse::item(['status' => $status]);
    }

    /** Devices this account is bound to, for the support desk. */
    public function devices(Request $request, User $user): JsonResponse
    {
        return ApiResponse::item([
            'device_limit' => (int) ($user->device_limit ?? 1),
            'devices' => app(DeviceGuard::class)->listFor($user),
        ]);
    }

    /**
     * Frees every device slot.
     *
     * The realistic support case: a student changed phone and is now locked out
     * of their own account. A reason is required because this is the control
     * that account sharing would try to abuse.
     */
    public function resetDevices(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:500'],
            'device_limit' => ['nullable', 'integer', 'min:1', 'max:5'],
        ]);

        $released = app(DeviceGuard::class)->releaseAll($user, 'reset_by_staff');

        if (array_key_exists('device_limit', $data) && $data['device_limit'] !== null) {
            $user->forceFill(['device_limit' => $data['device_limit']])->save();
        }

        $this->audit->log('user.devices_reset', $user, $request->user(), $data['reason'], [
            'released' => $released,
            'device_limit' => $user->device_limit,
        ]);

        return ApiResponse::item(['released' => $released, 'device_limit' => (int) ($user->device_limit ?? 1)]);
    }

    /**
     * Archives an account.
     *
     * Soft delete, deliberately: payments, receipts, attendance and audit
     * entries all reference the user, and removing the row outright would
     * orphan a paid history and break the audit trail — the one record that
     * must stay intact.
     *
     * The account is suspended in the same step, so an archived user cannot
     * sign in even where a stale session exists.
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();
        $this->authorize('delete', $user);

        if ($user->is($actor)) {
            throw DomainException::conflict(
                'You cannot archive your own account.',
                'cannot_archive_self',
            );
        }

        /*
         * Never leave the platform with no way in.
         *
         * Only a Super Admin can reach settings, integrations, role
         * management or another admin-tier account, so losing the last one
         * is the actual lockout risk — not the last plain Admin, since any
         * remaining Super Admin can always create another Admin.
         */
        if ($user->isSuperAdmin()) {
            $remaining = User::query()
                ->whereKeyNot($user->getKey())
                ->whereHas('roles', fn ($query) => $query->where('key', RoleKey::SuperAdmin->value))
                ->where('status', UserStatus::Active->value)
                ->count();

            if ($remaining === 0) {
                throw DomainException::conflict(
                    'This is the last active Super Admin. Promote another account first.',
                    'last_administrator',
                );
            }
        }

        $active = Enrollment::query()
            ->where('user_id', $user->getKey())
            ->accessible()
            ->count();

        if ($active > 0) {
            throw DomainException::conflict(
                "This account has {$active} course".($active === 1 ? '' : 's')
                    .' with active access. End or transfer the enrolment first, so the student is not cut off without a record of why.',
                'user_has_active_access',
            );
        }

        $this->assertArchivingDoesNotOrphanABatch($user);

        $reason = trim((string) $request->string('reason')->value());

        $this->audit->log('user.archived', $user, $actor, $reason ?: 'Account archived');

        $user->forceFill(['status' => UserStatus::Suspended->value])->save();
        $user->delete();

        return ApiResponse::message('Account archived. Payment history and audit entries are unaffected.');
    }

    /**
     * Archiving or suspending a teacher used to check nothing about the
     * batches they teach — only a student's own active enrollments were
     * guarded. Batch::teachers() has no enforced minimum, and neither
     * ClassSessionPolicy::start() nor finalizeAttendance() falls back to
     * admin the way manage() does (deliberately — starting a class and
     * attesting attendance are the assigned teacher's own acts), so the
     * sole teacher of a live, paying-student batch being archived or
     * suspended could silently make every class in it unstartable and its
     * attendance unmarkable, with nothing surfacing that until someone
     * noticed the blank teacher field.
     */
    protected function assertArchivingDoesNotOrphanABatch(User $user): void
    {
        $orphaned = Batch::query()
            ->whereIn('status', [BatchStatus::Open->value, BatchStatus::Ongoing->value])
            ->whereHas('teachers', fn ($query) => $query->where('users.id', $user->getKey()))
            ->whereDoesntHave('teachers', fn ($query) => $query
                ->where('users.id', '!=', $user->getKey())
                ->where('users.status', UserStatus::Active->value))
            ->first();

        if ($orphaned !== null) {
            throw DomainException::conflict(
                'This is the only active teacher on "'.$orphaned->title.'". Assign another teacher to that batch first, so its classes stay startable.',
                'user_is_sole_batch_teacher',
            );
        }
    }

    protected function sendPasswordReset(User $user): string
    {
        if (blank($user->email)) {
            return 'no_email_on_file';
        }

        Password::sendResetLink(['email' => $user->email]);

        return 'reset_link_sent';
    }

    /**
     * Ends every session AND Sanctum token this account holds — not just
     * database session rows. $user here is always a different account than
     * the acting admin, so there is no "current" credential of $user's own
     * to preserve; revokeOthers() naturally revokes everything in that case.
     */
    protected function revokeSessions(Request $request, User $user): string
    {
        $this->revoker->revokeOthers($request, $user);

        return 'sessions_revoked';
    }

    protected function resetMfa(Request $request, User $user): string
    {
        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        $this->revokeSessions($request, $user);

        return 'mfa_reset';
    }

    protected function setStatus(Request $request, User $user, UserStatus $status): string
    {
        $user->forceFill(['status' => $status->value])->save();

        if ($status === UserStatus::Suspended) {
            $this->revokeSessions($request, $user);
        }

        return $status->value;
    }

    protected function summary(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'mobile' => $user->mobile,
            'primary_role' => $user->primaryRoleKey()?->value ?? 'student',
            'status' => $user->status->value,
            'last_seen_at' => $user->last_seen_at?->toIso8601String(),
            'mfa_enabled' => $user->hasTwoFactorEnabled(),
        ];
    }

    protected function recentActivity(User $user): array
    {
        return \App\Models\AuditLog::query()
            ->where(fn ($query) => $query->where('actor_id', $user->getKey())
                ->orWhere(fn ($builder) => $builder->where('target_type', 'User')->where('target_id', $user->getKey())))
            ->orderByDesc('occurred_at')
            ->limit(15)
            ->get()
            ->map(fn ($entry) => [
                'id' => $entry->id,
                'occurred_at' => $entry->occurred_at->toIso8601String(),
                'action' => $entry->action,
                'detail' => $entry->reason ?? $entry->target_label ?? '',
            ])
            ->all();
    }
}
