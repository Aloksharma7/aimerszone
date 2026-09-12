<?php

use App\Http\Controllers\Api\V1\MediaController;
use Illuminate\Support\Facades\Route;

/*
 * Signed, short-lived media routes.
 *
 * The signature only proves the link was issued by us and has not expired.
 * Each controller method re-checks the current user's authorization, so an
 * expired enrollment or a revoked role invalidates a link that was already
 * handed out.
 *
 * `signed:relative`, not the default `signed`: the default signs the full
 * absolute URL, host included, and the request that mints one of these links
 * (a same-origin /api/... POST) and the later request that opens it (a
 * same-origin /media/... GET) travel through two separate proxy hops — Next's
 * rewrite, then this API's own nginx site — that are under no obligation to
 * agree on exactly what host/scheme they report upstream. That mismatch
 * signs a URL with one host and validates it against another, failing with
 * "Invalid signature." on a perfectly legitimate, unexpired link. Relative
 * signing (see MediaLinkService::sign()) drops host/scheme from the hash
 * entirely, so only the path and query — identical on both ends — matter.
 *
 * The web group is not listed here: this file is required from routes/web.php,
 * which already applies it. Repeating it would run StartSession and
 * EncryptCookies twice on the same request.
 */
Route::middleware(['auth', 'signed:relative', 'throttle:60,1'])
    ->prefix('media')
    ->name('media.')
    ->group(function () {
        Route::get('resources/{resource}', [MediaController::class, 'resource'])->name('resource');
        Route::get('recordings/{recording}', [MediaController::class, 'recording'])->name('recording');
        Route::get('payments/{payment}/proof', [MediaController::class, 'paymentProof'])->name('payment-proof');
        Route::get('receipts/{receipt}', [MediaController::class, 'receipt'])->name('receipt');
    });
