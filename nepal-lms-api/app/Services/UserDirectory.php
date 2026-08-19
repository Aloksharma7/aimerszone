<?php

namespace App\Services;

use App\Enums\RoleKey;
use App\Enums\UserStatus;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Creation and role assignment for user accounts, shared by public
 * registration, staff onboarding and administrator user management.
 */
class UserDirectory
{
    public function __construct(protected SettingsRepository $settings) {}

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function createStudent(array $attributes, ?User $createdBy = null): User
    {
        return DB::transaction(function () use ($attributes, $createdBy) {
            $user = User::create([
                'name' => $attributes['name'],
                'mobile' => $attributes['mobile'] ?? null,
                'email' => $attributes['email'] ?? null,
                'password' => $attributes['password'] ?? Str::password(16),
                'locale' => $attributes['locale'] ?? 'en',
                'status' => UserStatus::Active->value,
                'student_code' => $this->nextStudentCode(),
                'must_change_password' => $attributes['must_change_password'] ?? false,
                'terms_accepted_at' => ($attributes['terms_accepted'] ?? false) ? now() : null,
                'recording_policy_acknowledged_at' => ($attributes['recording_policy_acknowledged'] ?? false) ? now() : null,
                'created_by' => $createdBy?->getKey(),
            ]);

            $this->assignRole($user, RoleKey::Student, $createdBy, primary: true);

            return $user->fresh();
        });
    }

    public function assignRole(User $user, RoleKey|string $role, ?User $assignedBy = null, bool $primary = false): void
    {
        $key = $role instanceof RoleKey ? $role->value : $role;
        $roleModel = Role::where('key', $key)->firstOrFail();

        $user->roles()->syncWithoutDetaching([
            $roleModel->getKey() => [
                'is_primary' => $primary,
                'assigned_by' => $assignedBy?->getKey(),
                'assigned_at' => now(),
            ],
        ]);

        $user->unsetRelation('roles');
    }

    /** Replaces every role with a single primary role, used by admin edits. */
    public function setPrimaryRole(User $user, RoleKey|string $role, ?User $assignedBy = null): void
    {
        $key = $role instanceof RoleKey ? $role->value : $role;
        $roleModel = Role::where('key', $key)->firstOrFail();

        $user->roles()->sync([
            $roleModel->getKey() => [
                'is_primary' => true,
                'assigned_by' => $assignedBy?->getKey(),
                'assigned_at' => now(),
            ],
        ]);

        if ($key === RoleKey::Student->value && blank($user->student_code)) {
            $user->forceFill(['student_code' => $this->nextStudentCode()])->save();
        }

        $user->unsetRelation('roles');
    }

    /**
     * Sequential, human-quotable identifier such as STU-2026-00042.
     * Wrapped in a lock so two concurrent registrations cannot collide.
     */
    public function nextStudentCode(): string
    {
        $prefix = $this->settings->string('operations.student_code_prefix', 'STU');
        $year = now()->year;

        return DB::transaction(function () use ($prefix, $year) {
            $latest = User::withTrashed()
                ->where('student_code', 'like', "{$prefix}-{$year}-%")
                ->lockForUpdate()
                ->orderByDesc('student_code')
                ->value('student_code');

            $sequence = $latest ? ((int) Str::afterLast($latest, '-')) + 1 : 1;

            return sprintf('%s-%d-%05d', $prefix, $year, $sequence);
        });
    }
}
