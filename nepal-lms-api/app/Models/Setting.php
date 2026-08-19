<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Runtime configuration owned by the administrator.
 *
 * Read through App\Services\SettingsRepository rather than directly, so that
 * caching, defaults and decryption stay in one place.
 */
class Setting extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['group', 'key', 'value', 'type', 'is_public', 'is_encrypted', 'updated_by'];

    protected function casts(): array
    {
        return [
            'value' => 'array',
            'is_public' => 'boolean',
            'is_encrypted' => 'boolean',
        ];
    }

    public function scopePublic($query)
    {
        return $query->where('is_public', true);
    }
}
