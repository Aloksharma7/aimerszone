<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;


class PaymentMethod extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'key',
        'name',
        'account_name',
        'account_identifier',
        'bank_name',
        'branch',
        'qr_image_path',
        'instructions',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order')->orderBy('name');
    }

    public function qrImageUrl(): ?string
    {
        return $this->qr_image_path ? Storage::disk('public')->url($this->qr_image_path) : null;
    }
}
