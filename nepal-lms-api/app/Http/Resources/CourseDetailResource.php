<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** ApiCourseDetail: summary plus syllabus and the full batch list. */
class CourseDetailResource extends CourseSummaryResource
{
    public function toArray(Request $request): array
    {
        return array_merge(parent::toArray($request), [
            'description' => $this->description ?? $this->short_description ?? '',
            'syllabus' => SyllabusModuleResource::collection($this->whenLoaded('modules')),
        ]);
    }
}
