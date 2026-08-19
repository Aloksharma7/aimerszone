<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Http\Resources\StudentReceiptResource;
use App\Models\Receipt;
use App\Services\MediaLinkService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReceiptController extends Controller
{
    public function __construct(protected MediaLinkService $links) {}

    public function index(Request $request): JsonResponse
    {
        $receipts = Receipt::query()
            ->whereHas('payment', fn ($query) => $query->where('user_id', $request->user()->getKey()))
            ->orderByDesc('issued_at')
            ->paginate($this->perPage(20));

        return ApiResponse::paginated($receipts, fn (Receipt $receipt) => (new StudentReceiptResource($receipt))->toArray($request));
    }

    public function show(Request $request, string $receiptId): JsonResponse
    {
        return ApiResponse::item(new StudentReceiptResource($this->find($request, $receiptId)));
    }

    public function download(Request $request, string $receiptId): JsonResponse
    {
        $receipt = $this->find($request, $receiptId);

        $destination = $this->links->forReceipt($receipt->getKey());

        return ApiResponse::destination($destination['url'], $destination['expires_at'], [
            'filename' => 'receipt-'.$receipt->number.'.pdf',
        ]);
    }

    /** Scoped through the payment, so another student's receipt is a 404. */
    protected function find(Request $request, string $receiptId): Receipt
    {
        return Receipt::query()
            ->whereHas('payment', fn ($query) => $query->where('user_id', $request->user()->getKey()))
            ->whereKey($receiptId)
            ->firstOrFail();
    }
}
