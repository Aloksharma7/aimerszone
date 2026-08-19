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
 * The web group is not listed here: this file is required from routes/web.php,
 * which already applies it. Repeating it would run StartSession and
 * EncryptCookies twice on the same request.
 */
Route::middleware(['auth', 'signed', 'throttle:60,1'])
    ->prefix('media')
    ->name('media.')
    ->group(function () {
        Route::get('resources/{resource}', [MediaController::class, 'resource'])->name('resource');
        Route::get('recordings/{recording}', [MediaController::class, 'recording'])->name('recording');
        Route::get('payments/{payment}/proof', [MediaController::class, 'paymentProof'])->name('payment-proof');
        Route::get('receipts/{receipt}', [MediaController::class, 'receipt'])->name('receipt');
    });
