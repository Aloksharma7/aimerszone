<?php

namespace App\Http\Middleware;

use App\Models\IdempotencyKey;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Replay protection for sensitive mutations.
 *
 * The frontend sends an Idempotency-Key header on payment submission, payment
 * decisions, attempt submission, administrator actions and settings changes.
 * A repeated key returns the first stored response instead of performing the
 * action twice; the same key with a different body is rejected.
 */
class HandleIdempotentRequest
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->header('Idempotency-Key');

        if (! is_string($key) || trim($key) === '') {
            return $next($request);
        }

        $key = substr(trim($key), 0, 120);
        $endpoint = $request->method().' '.$request->path();
        $hash = hash('sha256', json_encode([
            $request->except(['_token']),
            $request->allFiles() ? array_keys($request->allFiles()) : [],
        ]));

        /*
         * Scoped to the caller as well as the key. Keys are client-generated,
         * so without this a key collision between two users would hand one of
         * them the other's stored response.
         */
        $userId = $request->user()?->getKey();

        $record = IdempotencyKey::query()
            ->where('key', $key)
            ->where('endpoint', $endpoint)
            ->where('user_id', $userId)
            ->first();

        if ($record !== null && $record->expires_at->isFuture()) {
            if ($record->request_hash !== $hash) {
                return ApiResponse::error(
                    'This idempotency key was already used with different data.',
                    'idempotency_key_reuse',
                    409,
                );
            }

            if ($record->status === 'completed') {
                return response()->json(
                    json_decode((string) $record->response_body, true) ?? [],
                    $record->response_code ?? 200,
                )->header('Idempotent-Replay', 'true');
            }

            /*
             * A duplicate that is genuinely still in flight is rejected — but
             * only while the lock is fresh.
             *
             * The completion write happens after the inner request returns, so
             * a worker that dies mid-request (timeout, fatal, OOM) leaves the
             * row stuck on 'processing' for the whole TTL. Without this window
             * every retry got a 409 for 24 hours, which on a payment
             * submission or approval means the user simply cannot proceed.
             */
            $stale = $record->locked_at !== null
                && $record->locked_at->lt(now()->subSeconds((int) config('lms.idempotency.lock_seconds', 90)));

            if (! $stale) {
                return ApiResponse::error(
                    'An identical request is still being processed.',
                    'request_in_progress',
                    409,
                );
            }
        }

        $record = IdempotencyKey::updateOrCreate(
            ['key' => $key, 'endpoint' => $endpoint, 'user_id' => $userId],
            [
                'user_id' => $userId,
                'request_hash' => $hash,
                'status' => 'processing',
                'locked_at' => now(),
                'response_code' => null,
                'response_body' => null,
                'completed_at' => null,
                'expires_at' => now()->addHours((int) config('lms.idempotency.ttl_hours', 24)),
            ],
        );

        $response = $next($request);

        if ($response instanceof JsonResponse && $response->isSuccessful()) {
            $record->forceFill([
                'status' => 'completed',
                'response_code' => $response->getStatusCode(),
                'response_body' => $response->getContent(),
                'completed_at' => now(),
            ])->save();
        } else {
            // Failures are not replayable: let the client retry cleanly.
            DB::table('idempotency_keys')->where('id', $record->getKey())->delete();
        }

        return $response;
    }
}
