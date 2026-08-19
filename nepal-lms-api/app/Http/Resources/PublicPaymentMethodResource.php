<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The published account details shown on /payment-instructions.
 * Administrators own these values; nothing here is hard-coded in the frontend.
 */
class PublicPaymentMethodResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'account_name' => $this->account_name,
            'account_identifier' => $this->account_identifier,
            'qr_image_url' => $this->qrImageUrl(),
            'instructions' => $this->instructions,
        ];
    }
}
