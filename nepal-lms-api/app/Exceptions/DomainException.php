<?php

namespace App\Exceptions;

use Exception;

/**
 * Business-rule failure with an explicit machine code, e.g. a payment that is
 * no longer reviewable or a test attempt that has already expired.
 */
class DomainException extends Exception
{
    public function __construct(
        string $message,
        protected string $errorCode = 'conflict',
        protected int $status = 409,
        protected array $errorBag = [],
    ) {
        parent::__construct($message);
    }

    public static function conflict(string $message, string $code = 'conflict'): self
    {
        return new self($message, $code, 409);
    }

    public static function forbidden(string $message, string $code = 'forbidden'): self
    {
        return new self($message, $code, 403);
    }

    public static function unprocessable(string $message, string $code = 'unprocessable', array $errors = []): self
    {
        return new self($message, $code, 422, $errors);
    }

    public static function gone(string $message, string $code = 'gone'): self
    {
        return new self($message, $code, 410);
    }

    /**
     * Distinct from letting a bare abort(404) fall through: that renders as
     * the exact same generic "The requested record was not found." for
     * every 404 in the app (a missing model, a missing file, a route that
     * plain doesn't exist), which is exactly the ambiguity that made a
     * payment with no proof on disk indistinguishable from one whose proof
     * was simply never uploaded.
     */
    public static function notFound(string $message, string $code = 'not_found'): self
    {
        return new self($message, $code, 404);
    }

    public function code(): string
    {
        return $this->errorCode;
    }

    public function status(): int
    {
        return $this->status;
    }

    public function errors(): array
    {
        return $this->errorBag;
    }
}
