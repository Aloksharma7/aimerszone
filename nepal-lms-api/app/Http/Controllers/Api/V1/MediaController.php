<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Receipt;
use App\Models\Recording;
use App\Models\Resource;
use App\Models\ResourceDownload;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Terminus for every signed media link.
 *
 * The signature proves the link was issued by us and has not expired; these
 * methods still re-run the policy, so a link handed out before access was
 * revoked stops working immediately.
 */
class MediaController extends Controller
{
    public function resource(Request $request, Resource $resource): StreamedResponse
    {
        $this->authorize('download', $resource);

        ResourceDownload::create([
            'resource_id' => $resource->getKey(),
            'user_id' => $request->user()->getKey(),
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 500),
            'created_at' => now(),
        ]);

        return $this->stream($resource->storage_disk, $resource->storage_path, $resource->title, $resource->mime_type);
    }

    public function recording(Request $request, Recording $recording): StreamedResponse
    {
        $this->authorize('play', $recording);

        abort_unless(filled($recording->storage_path), 404);

        return $this->stream($recording->storage_disk ?? 'local', $recording->storage_path, $recording->title, 'video/mp4', inline: true);
    }

    public function paymentProof(Request $request, Payment $payment): StreamedResponse
    {
        $this->authorize('viewProof', $payment);

        abort_unless($payment->hasProof(), 404);

        return $this->stream(
            $payment->proof_disk ?? 'local',
            $payment->proof_path,
            'payment-evidence-'.$payment->getKey(),
            $payment->proof_mime,
            inline: true,
        );
    }

    public function receipt(Request $request, Receipt $receipt): StreamedResponse
    {
        $this->authorize('view', $receipt->payment);

        abort_unless(filled($receipt->pdf_path), 404);

        return $this->stream('local', $receipt->pdf_path, 'receipt-'.$receipt->number, 'application/pdf', inline: true);
    }

    protected function stream(string $disk, string $path, string $filename, ?string $mime, bool $inline = false): StreamedResponse
    {
        $storage = Storage::disk($disk);

        abort_unless($storage->exists($path), 404);

        $extension = pathinfo($path, PATHINFO_EXTENSION);
        $name = trim($filename).($extension ? '.'.$extension : '');

        $headers = array_filter([
            'Content-Type' => $mime,
            'Cache-Control' => 'no-store, private',

            // Evidence and recordings are rendered in the page, so the browser
            // must not be allowed to sniff a different content type.
            'X-Content-Type-Options' => 'nosniff',
        ]);

        // response() sets an inline disposition; download() forces attachment.
        // Passing an inline header to download() would conflict with the
        // disposition it sets itself.
        return $inline
            ? $storage->response($path, $name, $headers)
            : $storage->download($path, $name, $headers);
    }
}
