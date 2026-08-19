<?php

namespace App\Support;

use App\Exceptions\DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
use Throwable;

/**
 * Maps every failure onto the stable machine codes the frontend switches on.
 *
 * 401 unauthenticated | 403 forbidden | 419 session_expired
 * 422 validation_failed | 409 conflict | 429 rate_limited | 5xx server_error
 */
class ApiExceptionRenderer
{
    public static function register(Exceptions $exceptions): void
    {
        $exceptions->dontReport(DomainException::class);

        $exceptions->render(function (Throwable $e, Request $request) {
            // Signed media links (recordings, receipts, payment proof) are
            // opened directly by the browser — no Accept: application/json —
            // so without this they fell through to Laravel's raw HTML/debug
            // error page instead of a clean response when a session had
            // expired or access had been revoked.
            if (! $request->expectsJson() && ! $request->is('api/*') && ! $request->is('media/*')) {
                return null;
            }

            return self::toResponse($e);
        });
    }

    protected static function firstValidationMessage(ValidationException $e): string
    {
        $first = collect($e->errors())->flatten()->first();

        return is_string($first) && $first !== ''
            ? $first
            : 'The submitted information could not be accepted.';
    }

    protected static function toResponse(Throwable $e)
    {
        return match (true) {
            /*
             * Lead with the first field message rather than a generic line.
             * The frontend's ErrorMessage component renders `message` only, so
             * a generic string there leaves the user with nothing actionable.
             */
            $e instanceof ValidationException => ApiResponse::error(
                self::firstValidationMessage($e),
                'validation_failed',
                422,
                $e->errors(),
            ),

            $e instanceof AuthenticationException => ApiResponse::error(
                'Authentication is required to continue.',
                'unauthenticated',
                401,
            ),

            // Sanctum returns 419 for a stale CSRF token; the browser client
            // re-primes /sanctum/csrf-cookie and retries once on this code.
            $e instanceof TokenMismatchException => ApiResponse::error(
                'The session token expired. Please retry.',
                'session_expired',
                419,
            ),

            $e instanceof AuthorizationException => ApiResponse::error(
                $e->getMessage() ?: 'You are not allowed to perform this action.',
                'forbidden',
                403,
            ),

            $e instanceof ModelNotFoundException, $e instanceof NotFoundHttpException => ApiResponse::error(
                'The requested record was not found.',
                'not_found',
                404,
            ),

            $e instanceof TooManyRequestsHttpException => ApiResponse::error(
                'Too many attempts. Please wait before trying again.',
                'rate_limited',
                429,
            ),

            $e instanceof DomainException => ApiResponse::error(
                $e->getMessage(),
                $e->code(),
                $e->status(),
                $e->errors(),
            ),

            $e instanceof HttpExceptionInterface => ApiResponse::error(
                $e->getMessage() ?: 'The request could not be completed.',
                'request_failed',
                $e->getStatusCode(),
            ),

            // Never leak internals: the request id is the support handle.
            default => ApiResponse::error(
                config('app.debug') ? $e->getMessage() : 'An unexpected error occurred. Quote the request id when reporting this.',
                'server_error',
                500,
            ),
        };
    }
}
