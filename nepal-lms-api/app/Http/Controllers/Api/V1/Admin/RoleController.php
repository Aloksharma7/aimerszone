<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Role and permission composition behind /admin/roles.
 *
 * Protected roles keep their key so that portal routing and policies remain
 * stable; only their description and permission set may change.
 */
class RoleController extends Controller
{
    public function __construct(protected AuditLogger $audit) {}

    public function index(): JsonResponse
    {
        $roles = Role::assignable()->withCount('users')->with('permissions:id,key')->get();

        return ApiResponse::collection($roles->map(fn (Role $role) => [
            'id' => $role->id,
            'key' => $role->key,
            'name' => $role->name,
            'users_count' => (int) $role->users_count,
            'description' => (string) $role->description,
            'permissions' => $role->key === 'super_admin' ? ['*'] : $role->permissions->pluck('key')->values()->all(),
            'protected' => (bool) $role->is_protected,
        ]));
    }

    public function permissions(): JsonResponse
    {
        return ApiResponse::collection(
            Permission::orderBy('group')->orderBy('key')->get()->map(fn (Permission $permission) => [
                'id' => $permission->id,
                'key' => $permission->key,
                'group' => $permission->group,
                'description' => $permission->description,
            ]),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:80', Rule::unique('roles', 'name')],
            'description' => ['nullable', 'string', 'max:255'],
            'permissions' => ['array'],
            'permissions.*' => ['string', Rule::exists('permissions', 'key')],
        ]);

        $role = Role::create([
            'key' => Str::slug($data['name'], '_'),
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'is_protected' => false,
        ]);

        $role->permissions()->sync(Permission::whereIn('key', $data['permissions'] ?? [])->pluck('id'));

        $this->audit->log('role.created', $role, $request->user(), properties: ['permissions' => $data['permissions'] ?? []]);

        return ApiResponse::item(['id' => $role->id], status: 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:3', 'max:80', Rule::unique('roles', 'name')->ignore($role->getKey())],
            'description' => ['nullable', 'string', 'max:255'],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', Rule::exists('permissions', 'key')],
        ]);

        // The super admin role always holds every permission implicitly
        // (see Gate::before) regardless of what is synced here; editing it
        // would create a false impression of restricted access.
        if ($role->key === 'super_admin') {
            return ApiResponse::error(
                'The super admin role always holds every permission and cannot be edited.',
                'role_protected',
                409,
            );
        }

        $before = $role->permissions->pluck('key')->all();

        $role->fill(collect($data)->only(['name', 'description'])->all())->save();

        if (array_key_exists('permissions', $data)) {
            $role->permissions()->sync(Permission::whereIn('key', $data['permissions'])->pluck('id'));
        }

        $this->audit->log('role.updated', $role, $request->user(), properties: [
            'before' => $before,
            'after' => $data['permissions'] ?? $before,
        ]);

        return ApiResponse::item(['id' => $role->id]);
    }

    public function destroy(Request $request, Role $role): JsonResponse
    {
        if ($role->is_protected) {
            return ApiResponse::error('This role is part of the platform and cannot be deleted.', 'role_protected', 409);
        }

        if ($role->users()->exists()) {
            return ApiResponse::error('Reassign the users holding this role before deleting it.', 'role_in_use', 409);
        }

        $this->audit->log('role.deleted', $role, $request->user());
        $role->delete();

        return ApiResponse::message('Role deleted.');
    }
}
