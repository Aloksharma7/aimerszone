<?php

namespace App\Http\Controllers\Api\V1\Teacher;

use App\Http\Controllers\Controller;
use App\Models\SyllabusModule;
use App\Services\AccessGuard;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only, nested list of a batch's course syllabus (modules with their
 * lessons), for the "which lesson is this for" picker on the recording and
 * resource upload forms. Authoring the syllabus itself stays admin-only
 * (Admin\SyllabusController) — this only lets a teacher attach their own
 * content to a lesson that already exists, not create or rename one.
 */
class SyllabusModuleController extends Controller
{
    use ResolvesTeacherScope;

    public function __construct(protected AccessGuard $guard) {}

    public function index(Request $request, string $batchId): JsonResponse
    {
        $batch = $this->resolveBatch($batchId, $request->user());

        $modules = SyllabusModule::query()
            ->where('course_id', $batch->course_id)
            ->with('lessons')
            ->ordered()
            ->get();

        return ApiResponse::collection($modules->map(fn (SyllabusModule $module) => [
            'id' => $module->id,
            'title' => $module->title,
            'lessons' => $module->lessons->sortBy('order')->values()->map(fn ($lesson) => [
                'id' => $lesson->id,
                'title' => $lesson->title,
                'type' => $lesson->type,
            ])->all(),
        ]));
    }
}
