<?php

namespace App\Services;

use App\Models\Receipt;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

/**
 * Renders a receipt's snapshot to a stored PDF, once, at issue time.
 *
 * The snapshot already froze the truthful values (course title, price,
 * institution name) when the receipt was issued; this only turns that data
 * into the document a student or accountant actually downloads.
 */
class ReceiptPdfService
{
    public function generate(Receipt $receipt): string
    {
        $pdf = Pdf::loadView('receipts.pdf', ['receipt' => $receipt]);

        $path = 'receipts/'.$receipt->getKey().'.pdf';

        Storage::disk('local')->put($path, $pdf->output());

        return $path;
    }
}
