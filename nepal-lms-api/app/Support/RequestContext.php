<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Holds the correlation id for the current request so that responses,
 * audit entries and logs can all quote the same value.
 */
class RequestContext
{
    protected ?string $requestId = null;

    public function setRequestId(string $requestId): void
    {
        $this->requestId = $requestId;
    }

    public function requestId(): string
    {
        return $this->requestId ??= (string) Str::uuid();
    }
}
