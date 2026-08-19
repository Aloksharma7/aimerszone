<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Matches the frontend's AuthenticatedUser["user"] contract. */
class UserSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'mobile' => $this->mobile,
            'email' => $this->email,
            'student_code' => $this->student_code,
            'avatar_url' => $this->avatarUrl(),
            'status' => $this->status->value === 'pending' ? 'active' : $this->status->value,
        ];
    }
}
