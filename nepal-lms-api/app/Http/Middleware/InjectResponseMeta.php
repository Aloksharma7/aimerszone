<?php

namespace App\Http\Middleware;

use App\Support\RequestContext;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guarantees meta.request_id and meta.generated_at on every successful JSON
 * envelope without each controller having to add them.
 */
class InjectResponseMeta
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $response instanceof JsonResponse || $response->isServerError()) {
            return $response;
        }

        $payload = $response->getData(true);

        if (! is_array($payload) || ! array_key_exists('data', $payload)) {
            return $response;
        }

        $meta = $payload['meta'] ?? [];
        $meta['request_id'] ??= app(RequestContext::class)->requestId();
        $meta['generated_at'] ??= now()->toIso8601String();
        $payload['meta'] = $meta;

        $response->setData($payload);

        return $response;
    }
}
