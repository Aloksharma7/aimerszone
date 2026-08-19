<?php

namespace App\Models;

use App\Enums\RoleKey;
use App\Enums\UserStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, HasUlids, Notifiable, SoftDeletes;

    protected $fillable = [
        'name', 'mobile', 'email', 'password', 'student_code', 'staff_code',
        'avatar_path', 'locale', 'status', 'must_change_password',
        'terms_accepted_at', 'recording_policy_acknowledged_at', 'created_by', 'device_limit',
    ];

    protected $hidden = [
        'password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes',
    ];

    protected function casts(): array
    {
        return [
            'status' => UserStatus::class,
            'password' => 'hashed',
            'two_factor_secret' => 'encrypted',
            'two_factor_recovery_codes' => 'encrypted:array',
            'email_verified_at' => 'datetime',
            'mobile_verified_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
            'password_changed_at' => 'datetime',
            'locked_until' => 'datetime',
            'last_seen_at' => 'datetime',
            'last_login_at' => 'datetime',
            'terms_accepted_at' => 'datetime',
            'recording_policy_acknowledged_at' => 'datetime',
            'must_change_password' => 'boolean',
        ];
    }

    /* ----------------------------------------------------------------
     | Relationships
     | ---------------------------------------------------------------- */

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class)->withPivot(['is_primary', 'assigned_by', 'assigned_at']);
    }

    public function deviceSessions(): HasMany
    {
        return $this->hasMany(DeviceSession::class);
    }

    public function teacherProfile(): HasOne
    {
        return $this->hasOne(TeacherProfile::class);
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class);
    }

    public function testAttempts(): HasMany
    {
        return $this->hasMany(TestAttempt::class);
    }

    public function taughtBatches(): BelongsToMany
    {
        return $this->belongsToMany(Batch::class, 'batch_teacher')->withPivot('is_lead');
    }

    public function classSessions(): HasMany
    {
        return $this->hasMany(ClassSession::class, 'teacher_id');
    }

    public function supportTickets(): HasMany
    {
        return $this->hasMany(SupportTicket::class);
    }

    /* ----------------------------------------------------------------
     | Authorization
     | ---------------------------------------------------------------- */

    /** @return Collection<int, string> */
    public function roleKeys(): Collection
    {
        return $this->relationLoaded('roles')
            ? $this->roles->pluck('key')
            : $this->roles()->pluck('key');
    }

    public function hasRole(RoleKey|string $role): bool
    {
        $key = $role instanceof RoleKey ? $role->value : $role;

        return $this->roleKeys()->contains($key);
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole(RoleKey::SuperAdmin);
    }

    /**
     * True for both admin tiers. Super Admin still has strictly more access
     * (the unconditional policy bypass and the full permission wildcard) —
     * this is for the many checks that mean "either kind of administrator",
     * such as portal access and record-ownership overrides.
     */
    public function isAdmin(): bool
    {
        return $this->hasRole(RoleKey::Admin) || $this->isSuperAdmin();
    }

    /**
     * Effective permission keys, unioned across every assigned role.
     * Only Super Admin receives the wildcard automatically — Admin's
     * permissions come from its role row like everyone else, so it can be
     * scoped down without touching code.
     *
     * @return Collection<int, string>
     */
    public function permissionKeys(): Collection
    {
        if ($this->isSuperAdmin()) {
            return collect(['*']);
        }

        return $this->roles()
            ->with('permissions:id,key')
            ->get()
            ->flatMap(fn (Role $role) => $role->permissions->pluck('key'))
            ->unique()
            ->values();
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        $keys = $this->permissionKeys();

        return $keys->contains('*') || $keys->contains($permission);
    }

    /** The role that decides which portal the user lands on after sign-in. */
    public function primaryRoleKey(): ?RoleKey
    {
        $keys = $this->roleKeys();

        foreach (RoleKey::byPriority() as $candidate) {
            if ($keys->contains($candidate->value)) {
                return $candidate;
            }
        }

        return null;
    }

    public function portalHome(): string
    {
        return $this->primaryRoleKey()?->portalHome() ?? '/unauthorized';
    }

    /* ----------------------------------------------------------------
     | Account state
     | ---------------------------------------------------------------- */

    public function isActive(): bool
    {
        return $this->status === UserStatus::Active;
    }

    public function isLocked(): bool
    {
        return $this->locked_until !== null && $this->locked_until->isFuture();
    }

    public function hasTwoFactorEnabled(): bool
    {
        return $this->two_factor_secret !== null && $this->two_factor_confirmed_at !== null;
    }

    public function avatarUrl(): ?string
    {
        return $this->avatar_path ? Storage::disk('public')->url($this->avatar_path) : null;
    }

    /** Uses the queued notification that links to the Next.js reset page. */
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new \App\Notifications\ResetPassword($token));
    }

    public function initials(): string
    {
        return collect(preg_split('/\s+/', trim($this->name)))
            ->filter()
            ->take(2)
            ->map(fn (string $part) => mb_strtoupper(mb_substr($part, 0, 1)))
            ->implode('');
    }

    /* ----------------------------------------------------------------
     | Scopes
     | ---------------------------------------------------------------- */

    public function scopeWithRole($query, RoleKey|string $role)
    {
        $key = $role instanceof RoleKey ? $role->value : $role;

        return $query->whereHas('roles', fn ($builder) => $builder->where('key', $key));
    }

    public function scopeSearch($query, ?string $term)
    {
        if (blank($term)) {
            return $query;
        }

        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';

        return $query->where(fn ($builder) => $builder
            ->where('name', 'like', $like)
            ->orWhere('email', 'like', $like)
            ->orWhere('mobile', 'like', $like)
            ->orWhere('student_code', 'like', $like));
    }
}
