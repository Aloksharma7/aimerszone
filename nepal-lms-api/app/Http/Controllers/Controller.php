<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;

abstract class Controller extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    /** Clamp client-supplied page sizes to the configured maximum. */
    protected function perPage(int $default = 0): int
    {
        $default = $default ?: (int) config('lms.pagination.per_page', 25);
        $max = (int) config('lms.pagination.max_per_page', 100);
        $requested = (int) request()->integer('per_page', $default);

        return max(1, min($requested ?: $default, $max));
    }
}
