<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Support\Collection;

/**
 * Single place where the response envelope agreed with the frontend is built.
 *
 * Single resource:   { "data": {...}, "meta": { request_id, generated_at } }
 * Collection:        { "data": [...], "meta": {...} }
 * Pagination:        { "data": [...], "links": {...}, "meta": {...} }
 * Error:             { "message", "code", "errors"?, "request_id" }
 *
 * meta.request_id and meta.generated_at are appended by InjectResponseMeta,
 * so controllers never have to remember them.
 */
class ApiResponse
{
    public static function item(mixed $data, array $meta = [], int $status = 200): JsonResponse
    {
        $payload = ['data' => self::normalize($data)];

        if ($meta !== []) {
            $payload['meta'] = $meta;
        }

        return response()->json($payload, $status);
    }

    public static function collection(mixed $data, array $meta = [], int $status = 200): JsonResponse
    {
        return self::item(array_values(self::normalize($data)), $meta, $status);
    }

    /**
     * Laravel's paginator already emits the { data, links, meta } shape the
     * frontend's PaginatedResponse<T> type expects.
     */
    public static function paginated(LengthAwarePaginator $paginator, ?callable $map = null, array $meta = []): JsonResponse
    {
        if ($map !== null) {
            $paginator->setCollection($paginator->getCollection()->map($map)->values());
        }

        $payload = $paginator->toArray();

        $response = [
            'data' => $payload['data'],
            'links' => [
                'first' => $payload['first_page_url'] ?? null,
                'last' => $payload['last_page_url'] ?? null,
                'prev' => $payload['prev_page_url'] ?? null,
                'next' => $payload['next_page_url'] ?? null,
            ],
            'meta' => array_merge([
                'current_page' => $payload['current_page'],
                'from' => $payload['from'],
                'last_page' => $payload['last_page'],
                'path' => $payload['path'],
                'per_page' => (int) $payload['per_page'],
                'to' => $payload['to'],
                'total' => $payload['total'],
            ], $meta),
        ];

        return response()->json($response);
    }

    public static function message(string $message, array $data = [], int $status = 200): JsonResponse
    {
        return response()->json(array_filter([
            'message' => $message,
            'data' => $data ?: null,
        ], fn ($value) => $value !== null), $status);
    }

    public static function noContent(): JsonResponse
    {
        return response()->json(null, 204);
    }

    public static function error(string $message, string $code, int $status, array $errors = []): JsonResponse
    {
        $payload = [
            'message' => $message,
            'code' => $code,
            'request_id' => app(RequestContext::class)->requestId(),
        ];

        if ($errors !== []) {
            $payload['errors'] = $errors;
        }

        return response()->json($payload, $status);
    }

    /**
     * Short-lived destination contract used for live class joins, recording
     * playback, resource downloads and payment evidence.
     */
    public static function destination(string $url, \DateTimeInterface $expiresAt, array $extra = []): JsonResponse
    {
        return self::item(array_merge([
            'url' => $url,
            'expires_at' => $expiresAt->format(DATE_ATOM),
        ], $extra))->header('Cache-Control', 'no-store, private');
    }

    protected static function normalize(mixed $data): mixed
    {
        if ($data instanceof ResourceCollection || $data instanceof JsonResource) {
            return $data->resolve();
        }

        if ($data instanceof Collection) {
            return $data->all();
        }

        return $data;
    }
}
