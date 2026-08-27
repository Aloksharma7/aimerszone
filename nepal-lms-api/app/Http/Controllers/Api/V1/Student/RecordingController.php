<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Http\Resources\RecordingResource;
use App\Models\LessonCompletion;
use App\Models\Recording;
use App\Models\RecordingProgress;
use App\Services\AccessGuard;
use App\Services\EnrollmentProgressService;
use App\Services\MediaLinkService;
use App\Services\WatermarkService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecordingController extends Controller
{
    public function __construct(
        protected AccessGuard $guard,
        protected MediaLinkService $links,
        protected EnrollmentProgressService $progress,
        protected WatermarkService $watermark,
    ) {}

    /** Library across every batch the student currently has access to. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $batchIds = $this->guard->accessibleBatchIds($user);

        $recordings = Recording::query()
            ->whereIn('batch_id', $batchIds ?: ['-'])
            ->released()
            ->with(['batch.course', 'session.teacher'])
            ->when($request->filled('q'), fn ($query) => $query->where(
                'title',
                'like',
                // % and _ are LIKE wildcards: a student searching "50%" would
                // otherwise match every row.
                '%'.str_replace(['%', '_'], ['\%', '\_'], $request->string('q')->value()).'%',
            ))
            ->orderByDesc('released_at')
            ->paginate($this->perPage(24));

        $progress = RecordingProgress::query()
            ->where('user_id', $user->getKey())
            ->whereIn('recording_id', $recordings->getCollection()->pluck('id'))
            ->get()
            ->keyBy('recording_id');

        $enrollmentByBatch = $user->enrollments()->accessible()->get()->keyBy('batch_id');

        return ApiResponse::paginated($recordings, fn (Recording $recording) => (new RecordingResource($recording))
            ->additional([
                'enrollment_id' => $enrollmentByBatch[$recording->batch_id]->id ?? null,
                'progress_percent' => (int) ($progress[$recording->id]->progress_percent ?? 0),
            ])->toArray($request));
    }

    public function show(Request $request, Recording $recording): JsonResponse
    {
        $this->authorize('view', $recording);

        $recording->load(['batch.course', 'session.teacher']);

        $progress = RecordingProgress::query()
            ->where('user_id', $request->user()->getKey())
            ->where('recording_id', $recording->getKey())
            ->first();

        // index() already includes this; show() omitting it left every
        // single-recording fetch with enrollment_id undefined, which broke
        // both the course-scoped canonicalization redirect and the page's
        // own enrollment-match guard (it fails open when this is missing).
        $enrollment = $this->guard->enrollmentFor($request->user(), $recording->batch_id);

        return ApiResponse::item((new RecordingResource($recording))->additional([
            'enrollment_id' => $enrollment?->id,
            'progress_percent' => (int) ($progress->progress_percent ?? 0),
        ]));
    }

    /**
     * Returns a short-lived playback destination and records the resume point.
     * Called each time playback starts, so revoked access takes effect at once.
     */
    public function playback(Request $request, Recording $recording): JsonResponse
    {
        $this->authorize('play', $recording);

        $data = $request->validate([
            'progress_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'position_seconds' => ['nullable', 'integer', 'min:0'],
        ]);

        $existing = RecordingProgress::firstOrNew([
            'recording_id' => $recording->getKey(),
            'user_id' => $request->user()->getKey(),
        ]);

        $percent = max((int) ($existing->progress_percent ?? 0), (int) ($data['progress_percent'] ?? 0));

        $existing->fill([
            'progress_percent' => $percent,
            'last_position_seconds' => $data['position_seconds'] ?? $existing->last_position_seconds ?? 0,
            'last_watched_at' => now(),
            'completed_at' => $percent >= 95 ? ($existing->completed_at ?? now()) : $existing->completed_at,
        ])->save();

        if ($percent >= 95) {
            $enrollment = $this->guard->enrollmentFor($request->user(), $recording->batch_id);

            // Watching a lesson's video to the end is completing that
            // lesson — the two used to be entirely separate signals, so a
            // student could watch every recording and still show 0%
            // syllabus progress until they also went and manually ticked
            // every matching checkbox by hand.
            if ($enrollment !== null && filled($recording->syllabus_lesson_id)) {
                LessonCompletion::updateOrCreate(
                    ['user_id' => $request->user()->getKey(), 'syllabus_lesson_id' => $recording->syllabus_lesson_id],
                    ['enrollment_id' => $enrollment->getKey(), 'completed_at' => now()],
                );
            }

            if ($enrollment !== null) {
                $this->progress->recalculate($enrollment);
            }
        }

        $destination = $this->links->forRecording($recording);

        return ApiResponse::destination($destination['url'], $destination['expires_at'], [
            'resume_at_seconds' => (int) $existing->last_position_seconds,
            'provider' => $recording->source,

            // Regenerated per playback so it cannot be cached and stripped,
            // and it names the account a leaked capture came from.
            'watermark' => $this->watermark->forViewer($request->user()),
        ]);
    }
}
