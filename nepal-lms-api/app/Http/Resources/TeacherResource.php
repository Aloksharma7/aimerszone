<?php

namespace App\Http\Resources;

use App\Support\PublicAssetUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** ApiTeacher, used by /teachers and /teachers/{slug}. */
class TeacherResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,

            /*
             * The account behind the profile.
             *
             * `id` here is the teacher_profile id, which is not what anything
             * assigning a teacher needs: batch teacher_ids are validated
             * against users.id. Without this, picking a teacher who happens to
             * have a profile was rejected as invalid, while one without a
             * profile worked — because that path returned the user id under
             * the same key.
             */
            'user_id' => $this->user_id,
            'slug' => $this->slug,
            'name' => $this->user?->name ?? 'Faculty member',
            'role' => $this->headline,
            'subjects' => $this->subjects ?? [],
            'experience_summary' => $this->experience_summary,
            'bio' => $this->bio,
            'avatar_url' => PublicAssetUrl::for($this->avatar_path) ?? $this->user?->avatarUrl(),

            // Not shown on the public site itself — only the admin directory
            // reads these, to prefill the edit form without a second request.
            'is_public' => $this->is_public ?? true,
            'sort_order' => $this->sort_order ?? 0,
        ];
    }
}
