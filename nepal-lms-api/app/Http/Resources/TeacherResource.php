<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

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
            'avatar_url' => $this->avatar_path ? Storage::disk('public')->url($this->avatar_path) : null,
        ];
    }
}
