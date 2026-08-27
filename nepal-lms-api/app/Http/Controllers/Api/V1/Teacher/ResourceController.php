<?php

namespace App\Http\Controllers\Api\V1\Teacher;

use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Http\Resources\ResourceFileResource;
use App\Models\Resource;
use App\Models\SyllabusModule;
use App\Services\AccessGuard;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Uploading notes and PDFs.
 *
 * Students could already download resources; nothing could create one, so the
 * "Notes" feature every course card advertises was empty by construction.
 *
 * Files go to the private disk and are only ever served through the signed
 * media route, which re-checks enrollment when the link is opened. A resource
 * is invisible to students until it is released, so a teacher can stage a whole
 * module and publish it when the class reaches that point.
 */
class ResourceController extends Controller
{
    use ResolvesTeacherScope;

    public function __construct(
        protected AccessGuard $guard,
        protected AuditLogger $audit,
    ) {}

    public function index(Request $request, string $batchId): JsonResponse
    {
        $batch = $this->resolveBatch($batchId, $request->user());

        $resources = Resource::query()
            ->where('batch_id', $batch->getKey())
            ->with(['batch.course', 'course'])
            ->withCount('downloads')
            ->orderByDesc('created_at')
            ->get();

        return ApiResponse::collection($resources->map(fn (Resource $resource) => array_merge(
            (new ResourceFileResource($resource))->toArray($request),
            [
                'released' => $resource->isReleased(),
                'download_count' => (int) $resource->downloads_count,
                'is_public' => (bool) $resource->is_public,
            ],
        )));
    }

    public function store(Request $request, string $batchId): JsonResponse
    {
        $batch = $this->resolveBatch($batchId, $request->user());

        $maxKb = (int) config('lms.uploads.resource_max_kb', 51200);
        $mimes = implode(',', (array) config('lms.uploads.resource_mimes', ['pdf']));

        $data = $request->validate([
            'title' => ['required', 'string', 'min:2', 'max:180'],
            'module_title' => ['nullable', 'string', 'max:180'],
            'syllabus_lesson_id' => ['nullable', 'string', Rule::exists('syllabus_lessons', 'id')->where(
                fn ($query) => $query->whereIn('syllabus_module_id', SyllabusModule::where('course_id', $batch->course_id)->select('id')),
            )],
            'release_now' => ['nullable', 'boolean'],
            'release_at' => ['nullable', 'date'],

            // Free material any visitor may download, used for the public
            // free-learning section rather than paid batch content.
            'is_public' => ['nullable', 'boolean'],

            'file' => ['required', 'file', "mimes:{$mimes}", "max:{$maxKb}"],
        ]);

        $file = $request->file('file');

        // Detected from the file's own bytes. The upload header is attacker
        // controlled and this value is later used as a Content-Type.
        $mime = $file->getMimeType() ?: 'application/octet-stream';

        $path = $file->store('resources/'.$batch->getKey(), ['disk' => 'local']);

        if ($path === false) {
            throw DomainException::unprocessable('The file could not be stored. Try again.', 'upload_failed');
        }

        $releasedAt = match (true) {
            filled($data['release_at'] ?? null) => $data['release_at'],
            (bool) ($data['release_now'] ?? false) => now(),
            default => null,
        };

        $resource = Resource::create([
            'batch_id' => $batch->getKey(),
            'course_id' => $batch->course_id,
            'title' => $data['title'],
            'module_title' => $data['module_title'] ?? null,
            'syllabus_lesson_id' => $data['syllabus_lesson_id'] ?? null,
            'file_type' => strtoupper($file->getClientOriginalExtension() ?: 'FILE'),
            'mime_type' => $mime,
            'size_bytes' => $file->getSize(),
            'storage_path' => $path,
            'storage_disk' => 'local',
            'checksum' => hash_file('sha256', $file->getRealPath()),
            'released_at' => $releasedAt,
            'is_public' => (bool) ($data['is_public'] ?? false),
            'created_by' => $request->user()->getKey(),
        ]);

        $this->audit->log('resource.uploaded', $resource, $request->user(), properties: [
            'batch_id' => $batch->getKey(),
            'size' => $file->getSize(),
            'released' => $releasedAt !== null,
        ]);

        return ApiResponse::item([
            'id' => $resource->id,
            'released' => $resource->isReleased(),
        ], status: 201);
    }

    /** Rename, re-file under a module, or release/withdraw. */
    public function update(Request $request, string $batchId, Resource $resource): JsonResponse
    {
        $batch = $this->resolveBatch($batchId, $request->user());

        abort_unless($resource->batch_id === $batchId, 404);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'min:2', 'max:180'],
            'module_title' => ['sometimes', 'nullable', 'string', 'max:180'],
            'syllabus_lesson_id' => ['sometimes', 'nullable', 'string', Rule::exists('syllabus_lessons', 'id')->where(
                fn ($query) => $query->whereIn('syllabus_module_id', SyllabusModule::where('course_id', $batch->course_id)->select('id')),
            )],
            'release_at' => ['sometimes', 'nullable', 'date'],
            'is_public' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('release_at', $data)) {
            $data['released_at'] = $data['release_at'];
            unset($data['release_at']);
        }

        $resource->fill($data)->save();

        $this->audit->log('resource.updated', $resource, $request->user());

        return ApiResponse::item(['id' => $resource->id, 'released' => $resource->fresh()->isReleased()]);
    }

    /**
     * Soft deletes the record and removes the file.
     *
     * The row is kept so the download history stays meaningful, but the bytes
     * go: a withdrawn note should not sit on disk indefinitely.
     */
    public function destroy(Request $request, string $batchId, Resource $resource): JsonResponse
    {
        $this->resolveBatch($batchId, $request->user());

        abort_unless($resource->batch_id === $batchId, 404);

        $this->audit->log('resource.deleted', $resource, $request->user());

        $disk = $resource->storage_disk ?? 'local';
        $path = $resource->storage_path;

        $resource->delete();

        if (filled($path)) {
            rescue(fn () => Storage::disk($disk)->delete($path), null, false);
        }

        return ApiResponse::message('Resource removed.');
    }
}
