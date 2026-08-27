<?php

namespace App\Http\Controllers\Api\V1\Teacher;

use App\Enums\RecordingState;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Http\Resources\RecordingResource;
use App\Models\ClassSession;
use App\Models\Recording;
use App\Services\AccessGuard;
use App\Services\AuditLogger;
use App\Services\Integrations\IntegrationException;
use App\Services\Integrations\YouTubeClient;
use App\Models\SyllabusModule;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Recording release.
 *
 * Video lives on the institution's YouTube channel as unlisted; the LMS stores
 * only the id and controls who may play it. The video is verified through the
 * API on save, so a typo or a public video is caught before students see it.
 */
class RecordingController extends Controller
{
    use ResolvesTeacherScope;

    public function __construct(
        protected AccessGuard $guard,
        protected YouTubeClient $youtube,
        protected SettingsRepository $settings,
        protected AuditLogger $audit,
    ) {}

    public function index(Request $request, string $batchId): JsonResponse
    {
        $batch = $this->resolveBatch($batchId, $request->user());

        $recordings = Recording::query()
            ->where('batch_id', $batch->getKey())
            ->with(['batch.course', 'session.teacher'])
            ->orderByDesc('created_at')
            ->get();

        // is_public_warning is teacher-only operational detail — merged in
        // here rather than added to the shared RecordingResource, which the
        // student-facing endpoints also use.
        return ApiResponse::collection($recordings->map(
            fn (Recording $recording) => [
                ...(new RecordingResource($recording))->toArray($request),
                'is_public_warning' => $recording->is_youtube_public,
            ],
        ));
    }

    public function store(Request $request, string $batchId): JsonResponse
    {
        $batch = $this->resolveBatch($batchId, $request->user());

        $data = $request->validate([
            'session_id' => ['nullable', 'string'],
            'title' => ['required', 'string', 'min:3', 'max:180'],
            'youtube_video_id' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{11}$/'],
            'module_title' => ['nullable', 'string', 'max:180'],
            'syllabus_lesson_id' => ['nullable', 'string', Rule::exists('syllabus_lessons', 'id')->where(
                fn ($query) => $query->whereIn('syllabus_module_id', SyllabusModule::where('course_id', $batch->course_id)->select('id')),
            )],
            'release_at' => ['nullable', 'date'],
        ]);

        // A session id from the request is only accepted if it belongs to this
        // batch; otherwise a recording could be attached to another cohort.
        if (filled($data['session_id'] ?? null)) {
            $belongs = ClassSession::where('id', $data['session_id'])
                ->where('batch_id', $batch->getKey())
                ->exists();

            abort_unless($belongs, 422, 'That class does not belong to this batch.');
        }

        $verified = $this->verify($data['youtube_video_id']);

        $recording = Recording::create([
            'batch_id' => $batch->getKey(),
            'class_session_id' => $data['session_id'] ?? null,
            'title' => $data['title'],
            'module_title' => $data['module_title'] ?? null,
            'syllabus_lesson_id' => $data['syllabus_lesson_id'] ?? null,
            'source' => 'youtube',
            'youtube_video_id' => $data['youtube_video_id'],
            'thumbnail_url' => $verified['thumbnail_url'] ?? null,
            'duration_seconds' => $verified['duration_seconds'] ?? null,
            'recorded_at' => now(),

            // No release date means the teacher is staging it; students see
            // nothing until a date is set and has passed.
            'released_at' => $data['release_at'] ?? null,

            'state' => ($verified['state'] ?? null) === 'processed'
                ? RecordingState::Available->value
                : RecordingState::Processing->value,
            'sync_message' => $verified['message'] ?? null,
            'is_youtube_public' => $verified['public'] ?? false,
            'synced_at' => now(),
            'created_by' => $request->user()->getKey(),
        ]);

        if (filled($batch->youtube_playlist_id) && $verified['verified'] ?? false) {
            rescue(fn () => $this->youtube->addToPlaylist($batch->youtube_playlist_id, $data['youtube_video_id']), null, false);
        }

        $this->audit->log('recording.created', $recording, $request->user(), properties: [
            'video_id' => $data['youtube_video_id'],
            'verified' => $verified['verified'] ?? false,
        ]);

        return ApiResponse::item([
            'id' => $recording->id,
            'state' => $recording->state->value,
            'warning' => $verified['message'] ?? null,
            'is_public' => $verified['public'] ?? false,
        ], status: 201);
    }

    public function update(Request $request, string $batchId, Recording $recording): JsonResponse
    {
        $batch = $this->resolveBatch($batchId, $request->user());

        abort_unless($recording->batch_id === $batchId, 404);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'min:3', 'max:180'],
            'module_title' => ['sometimes', 'nullable', 'string', 'max:180'],
            'syllabus_lesson_id' => ['sometimes', 'nullable', 'string', Rule::exists('syllabus_lessons', 'id')->where(
                fn ($query) => $query->whereIn('syllabus_module_id', SyllabusModule::where('course_id', $batch->course_id)->select('id')),
            )],
            'release_at' => ['sometimes', 'nullable', 'date'],
        ]);

        if (array_key_exists('release_at', $data)) {
            $data['released_at'] = $data['release_at'];
            unset($data['release_at']);
        }

        $recording->fill($data)->save();

        $this->audit->log('recording.updated', $recording, $request->user());

        return ApiResponse::item(['id' => $recording->id]);
    }

    /**
     * Re-runs the YouTube check for a recording stuck in `processing` — the
     * original verify() at store() time never gets a second chance on its
     * own, so a video that was still encoding, or pasted before the
     * institution's YouTube integration was connected, would otherwise stay
     * invisible to students forever.
     */
    public function resync(Request $request, string $batchId, Recording $recording): JsonResponse
    {
        $this->resolveBatch($batchId, $request->user());

        abort_unless($recording->batch_id === $batchId, 404);

        $verified = $this->verify($recording->youtube_video_id);

        $recording->fill([
            'thumbnail_url' => $verified['thumbnail_url'] ?? $recording->thumbnail_url,
            'duration_seconds' => $verified['duration_seconds'] ?? $recording->duration_seconds,
            'state' => ($verified['state'] ?? null) === 'processed'
                ? RecordingState::Available->value
                : RecordingState::Processing->value,
            'sync_message' => $verified['message'] ?? null,
            'is_youtube_public' => $verified['public'] ?? false,
            'synced_at' => now(),
        ])->save();

        $this->audit->log('recording.resynced', $recording, $request->user(), properties: [
            'video_id' => $recording->youtube_video_id,
            'verified' => $verified['verified'] ?? false,
        ]);

        return ApiResponse::item([
            'id' => $recording->id,
            'state' => $recording->state->value,
            'warning' => $verified['message'] ?? null,
            'is_public' => $verified['public'] ?? false,
        ]);
    }

    /**
     * The video itself stays on YouTube; this only removes the LMS's
     * reference to it, freeing a wrongly-pasted id or fully retracting a
     * recording rather than just unpublishing it via release_at. A soft
     * delete like every other content type here — the row (and any watch
     * progress pointing at it) stays for history, just hidden from students
     * and teachers.
     */
    public function destroy(Request $request, string $batchId, Recording $recording): JsonResponse
    {
        $this->resolveBatch($batchId, $request->user());

        abort_unless($recording->batch_id === $batchId, 404);

        $this->audit->log('recording.deleted', $recording, $request->user(), properties: [
            'video_id' => $recording->youtube_video_id,
        ]);

        $recording->delete();

        return ApiResponse::message('Recording removed.');
    }

    /**
     * Confirms the video exists and is not publicly listed.
     *
     * When YouTube is not connected the recording is still saved — the teacher
     * gets a warning rather than a blocked workflow.
     *
     * @return array{verified: bool, public?: bool, state?: string, duration_seconds?: int, thumbnail_url?: ?string, message?: string}
     */
    protected function verify(string $videoId): array
    {
        if (! $this->settings->bool('integrations.youtube_enabled', false) || ! $this->youtube->isConfigured()) {
            return [
                'verified' => false,
                'message' => 'YouTube is not connected, so this video id could not be verified.',
            ];
        }

        try {
            $video = $this->youtube->video($videoId);
        } catch (IntegrationException $exception) {
            return ['verified' => false, 'message' => 'YouTube could not be reached: '.$exception->getMessage()];
        }

        if ($video === null) {
            throw DomainException::unprocessable(
                'No video was found for that id on the connected channel.',
                'video_not_found',
                ['youtube_video_id' => ['Check the video id and that it belongs to the institution channel.']],
            );
        }

        // A public video is reachable by anyone with the link, which hands paid
        // course content to the open internet — allowed by choice, not blocked,
        // but flagged so the teacher list keeps warning about it until it's
        // switched to unlisted.
        $isPublic = ! $this->youtube->isSafelyRestricted($video);

        return [
            'verified' => true,
            'public' => $isPublic,
            'state' => $video['state'],
            'duration_seconds' => $video['duration_seconds'],
            'thumbnail_url' => $video['thumbnail_url'],
            'message' => match (true) {
                $isPublic => 'This video is public on YouTube — anyone with the link can watch it, even people who never enrolled. Set it to unlisted when you can.',
                $video['state'] !== 'processed' => 'YouTube is still processing this video.',
                default => null,
            },
        ];
    }
}
