<?php

namespace App\Services\Integrations;

use RuntimeException;

/**
 * A provider call failed. Carries whether retrying is sensible, so callers can
 * distinguish "Zoom is briefly unavailable" from "these credentials are wrong".
 */
class IntegrationException extends RuntimeException
{
    public function __construct(
        string $message,
        protected string $provider,
        protected bool $retryable = false,
        protected ?int $status = null,
    ) {
        parent::__construct($message);
    }

    public function provider(): string
    {
        return $this->provider;
    }

    public function isRetryable(): bool
    {
        return $this->retryable;
    }

    public function status(): ?int
    {
        return $this->status;
    }
}
