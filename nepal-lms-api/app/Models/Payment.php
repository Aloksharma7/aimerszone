<?php

namespace App\Models;

use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Payment extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'user_id', 'course_id', 'batch_id', 'enrollment_id', 'payment_method_id', 'status',
        'expected_amount_npr', 'submitted_amount_npr', 'payer_name', 'transaction_reference',
        'paid_at', 'submitted_at', 'note', 'proof_path', 'proof_disk', 'proof_mime',
        'proof_size', 'proof_hash', 'reviewed_by', 'reviewed_at', 'review_note',
        'rejection_reason', 'risk_label', 'submitted_by', 'idempotency_key',
    ];

    /* Evidence location is served through an authorized signed route only. */
    protected $hidden = ['proof_path', 'proof_hash'];

    protected function casts(): array
    {
        return [
            'status' => PaymentStatus::class,
            'paid_at' => 'datetime',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'expected_amount_npr' => 'integer',
            'submitted_amount_npr' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function method(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class, 'payment_method_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function receipt(): HasOne
    {
        return $this->hasOne(Receipt::class);
    }

    public function hasProof(): bool
    {
        return filled($this->proof_path);
    }

    /** Only these states may be approved or rejected. */
    public function isReviewable(): bool
    {
        return $this->status->isReviewable();
    }

    public function scopePendingReview($query)
    {
        return $query->whereIn('status', [PaymentStatus::Submitted->value, PaymentStatus::UnderReview->value]);
    }

    public function scopeApproved($query)
    {
        return $query->where('status', PaymentStatus::Approved->value);
    }
}
