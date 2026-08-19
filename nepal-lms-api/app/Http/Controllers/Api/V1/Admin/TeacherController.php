<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\RoleKey;
use App\Http\Controllers\Controller;
use App\Http\Resources\TeacherResource;
use App\Models\TeacherProfile;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\UserDirectory;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Faculty directory administration.
 *
 * Includes teachers without a public profile, which the public /teachers
 * endpoint deliberately hides.
 */
class TeacherController extends Controller
{
    public function __construct(
        protected UserDirectory $directory,
        protected AuditLogger $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $teachers = User::query()
            ->withRole(RoleKey::Teacher)
            ->with('teacherProfile')
            ->orderBy('name')
            ->paginate($this->perPage(100));

        return ApiResponse::paginated($teachers, function (User $teacher) use ($request) {
            $profile = $teacher->teacherProfile;

            if ($profile !== null) {
                $profile->setRelation('user', $teacher);

                return (new TeacherResource($profile))->toArray($request);
            }

            // A teacher account without a profile still has to appear here, or
            // the administrator cannot tell that the profile is missing.
            return [
                'id' => $teacher->id,
                'user_id' => $teacher->id,
                'slug' => Str::slug($teacher->name),
                'name' => $teacher->name,
                'role' => 'Faculty',
                'subjects' => [],
                'experience_summary' => null,
                'bio' => null,
                'avatar_url' => $teacher->avatarUrl(),
            ];
        });
    }

    /** Creates or updates the public-facing profile for a teacher account. */
    public function upsert(Request $request, User $user): JsonResponse
    {
        abort_unless($user->hasRole(RoleKey::Teacher), 422, 'This account does not hold the teacher role.');

        $data = $request->validate([
            'slug' => ['sometimes', 'string', 'max:140', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('teacher_profiles', 'slug')->ignore($user->teacherProfile?->getKey())],
            'headline' => ['sometimes', 'nullable', 'string', 'max:120'],
            'subjects' => ['sometimes', 'array', 'max:12'],
            'subjects.*' => ['string', 'max:60'],
            'experience_summary' => ['sometimes', 'nullable', 'string', 'max:255'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'is_public' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ]);

        $profile = TeacherProfile::updateOrCreate(
            ['user_id' => $user->getKey()],
            array_merge($data, ['slug' => $data['slug'] ?? $user->teacherProfile?->slug ?? Str::slug($user->name)]),
        );

        $this->audit->log('teacher.profile_saved', $profile, $request->user(), targetLabel: $user->name);

        return ApiResponse::item(['id' => $profile->id, 'slug' => $profile->slug]);
    }
}
