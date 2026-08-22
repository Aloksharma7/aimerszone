<?php

namespace App\Models;

use App\Enums\AccessType;
use App\Enums\BatchStatus;
use App\Enums\CourseStatus;
use App\Support\PublicAssetUrl;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Course extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $fillable = [
        'category_id', 'slug', 'code', 'title', 'short_title', 'short_description',
        'description', 'thumbnail_path', 'access_type', 'price_npr', 'original_price_npr',
        'features', 'published', 'published_at', 'status', 'owner_id', 'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'access_type' => AccessType::class,
            'status' => CourseStatus::class,
            'features' => 'array',
            'published' => 'boolean',
            'published_at' => 'datetime',
            'price_npr' => 'integer',
            'original_price_npr' => 'integer',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function batches(): HasMany
    {
        return $this->hasMany(Batch::class);
    }

    public function modules(): HasMany
    {
        return $this->hasMany(SyllabusModule::class)->orderBy('order');
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function tests(): HasMany
    {
        return $this->hasMany(Test::class);
    }

    /* ----------------------------------------------------------------
     | Query scopes
     | ---------------------------------------------------------------- */

    /** Visible on the marketing site and to unauthenticated visitors. */
    public function scopePubliclyVisible($query)
    {
        return $query->where('published', true)->where('status', CourseStatus::Published->value);
    }

    public function scopeSearch($query, ?string $term)
    {
        if (blank($term)) {
            return $query;
        }

        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';

        return $query->where(fn ($builder) => $builder
            ->where('title', 'like', $like)
            ->orWhere('code', 'like', $like)
            ->orWhere('short_description', 'like', $like));
    }

    /* ----------------------------------------------------------------
     | Derived values used by the API resources
     | ---------------------------------------------------------------- */

    /**
     * `thumbnail_path` doubles as either a local storage path or a full
     * externally-hosted image URL (staff paste a CDN link rather than
     * uploading a file) — an absolute URL is returned as-is instead of
     * being run through the storage disk, which would otherwise mangle it
     * into something like ".../storage/https://cdn.example.com/course.jpg".
     */
    public function thumbnailUrl(): ?string
    {
        return PublicAssetUrl::for($this->thumbnail_path);
    }

    public function isFree(): bool
    {
        return $this->access_type === AccessType::Free;
    }

    /**
     * The cheapest enrollable batch price drives "starting from" pricing.
     * Falls back to the course price when no batch is open.
     */
    public function startingPrice(): int
    {
        if ($this->isFree()) {
            return 0;
        }

        $batchPrice = $this->relationLoaded('batches')
            ? $this->batches->whereIn('status', [BatchStatus::Open, BatchStatus::Ongoing])->min('price_npr')
            : $this->batches()->whereIn('status', [BatchStatus::Open->value, BatchStatus::Ongoing->value])->min('price_npr');

        return (int) ($batchPrice ?: $this->price_npr);
    }

    public function lessonsCount(): int
    {
        return (int) SyllabusLesson::query()
            ->whereIn('syllabus_module_id', $this->modules()->select('id'))
            ->count();
    }
}
