<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\RecalculateBatchProgress;
use App\Models\Course;
use App\Models\SyllabusLesson;
use App\Models\SyllabusModule;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Course syllabus authoring.
 *
 * A course could be created and published, but its modules and lessons had no
 * write path at all, so every student's syllabus tab was permanently empty.
 *
 * The whole syllabus is replaced in one call rather than exposing per-module
 * and per-lesson endpoints. A syllabus is edited as a single structure — drag a
 * lesson between modules and half a dozen rows change order at once — and one
 * atomic replace avoids the half-applied states that piecemeal editing produces.
 * Lesson ids are preserved where the caller sends them back, so existing
 * completion records survive a reorder.
 */
class SyllabusController extends Controller
{
    public function __construct(protected AuditLogger $audit) {}

    public function show(Request $request, string $course): JsonResponse
    {
        $model = $this->resolveCourse($course);

        $modules = SyllabusModule::query()
            ->where('course_id', $model->getKey())
            ->with('lessons')
            ->ordered()
            ->get();

        return ApiResponse::item([
            'course_id' => $model->id,
            'course_title' => $model->title,
            'modules' => $modules->map(fn (SyllabusModule $module) => [
                'id' => $module->id,
                'title' => $module->title,
                'summary' => $module->summary,
                'order' => (int) $module->order,
                'lessons' => $module->lessons->sortBy('order')->values()->map(fn (SyllabusLesson $lesson) => [
                    'id' => $lesson->id,
                    'title' => $lesson->title,
                    'type' => $lesson->type,
                    'order' => (int) $lesson->order,
                ])->all(),
            ])->values()->all(),
        ]);
    }

    public function update(Request $request, string $course): JsonResponse
    {
        $model = $this->resolveCourse($course);

        $data = $request->validate([
            'modules' => ['present', 'array', 'max:60'],
            'modules.*.id' => ['nullable', 'string'],
            'modules.*.title' => ['required', 'string', 'min:2', 'max:180'],
            'modules.*.summary' => ['nullable', 'string', 'max:500'],
            'modules.*.lessons' => ['present', 'array', 'max:100'],
            'modules.*.lessons.*.id' => ['nullable', 'string'],
            'modules.*.lessons.*.title' => ['required', 'string', 'min:2', 'max:180'],
            'modules.*.lessons.*.type' => ['nullable', Rule::in(['Lesson', 'Live class', 'Recording', 'Reading', 'Test', 'Assignment'])],
        ]);

        DB::transaction(function () use ($model, $data) {
            $keptModuleIds = [];
            $keptLessonIds = [];

            foreach ($data['modules'] as $moduleIndex => $modulePayload) {
                // Reuse the row when the caller sends an id that genuinely
                // belongs to this course; anything else is treated as new
                // rather than trusted, so an id from another course cannot be
                // captured by sending it here.
                $module = filled($modulePayload['id'] ?? null)
                    ? SyllabusModule::where('course_id', $model->getKey())->find($modulePayload['id'])
                    : null;

                $attributes = [
                    'course_id' => $model->getKey(),
                    'title' => $modulePayload['title'],
                    'summary' => $modulePayload['summary'] ?? null,
                    'order' => $moduleIndex,
                ];

                if ($module === null) {
                    $module = SyllabusModule::create($attributes);
                } else {
                    $module->fill($attributes)->save();
                }

                $keptModuleIds[] = $module->getKey();

                foreach ($modulePayload['lessons'] as $lessonIndex => $lessonPayload) {
                    $lesson = filled($lessonPayload['id'] ?? null)
                        ? SyllabusLesson::whereIn(
                            'syllabus_module_id',
                            SyllabusModule::where('course_id', $model->getKey())->select('id'),
                        )->find($lessonPayload['id'])
                        : null;

                    $lessonAttributes = [
                        'syllabus_module_id' => $module->getKey(),
                        'title' => $lessonPayload['title'],
                        'type' => $lessonPayload['type'] ?? 'Lesson',
                        'order' => $lessonIndex,
                    ];

                    if ($lesson === null) {
                        $lesson = SyllabusLesson::create($lessonAttributes);
                    } else {
                        // Keeping the id keeps every completion record against
                        // it, so reordering a syllabus never resets progress.
                        $lesson->fill($lessonAttributes)->save();
                    }

                    $keptLessonIds[] = $lesson->getKey();
                }
            }

            // Anything absent from the payload was removed in the editor.
            SyllabusLesson::query()
                ->whereIn('syllabus_module_id', SyllabusModule::where('course_id', $model->getKey())->select('id'))
                ->whereNotIn('id', $keptLessonIds ?: ['-'])
                ->delete();

            SyllabusModule::query()
                ->where('course_id', $model->getKey())
                ->whereNotIn('id', $keptModuleIds ?: ['-'])
                ->delete();
        });

        $this->audit->log('syllabus.updated', $model, $request->user(), properties: [
            'modules' => count($data['modules']),
        ]);

        // enrollment.syllabus_percent is a denormalised snapshot, refreshed
        // only when specific events happen (a lesson toggled, a recording
        // watched, attendance finalized) — adding, removing or reordering
        // lessons here was never one of those events. A student who'd
        // completed every lesson kept reading 100% forever after the
        // academic team added two more, while the syllabus tab's own
        // per-module numbers (computed live on every request) correctly
        // showed the new lessons as incomplete right below it.
        foreach ($model->batches()->pluck('id') as $batchId) {
            RecalculateBatchProgress::dispatch($batchId);
        }

        return $this->show($request, $course);
    }

    protected function resolveCourse(string $identifier): Course
    {
        return Course::query()
            ->where('id', $identifier)
            ->orWhere('slug', $identifier)
            ->firstOrFail();
    }
}
