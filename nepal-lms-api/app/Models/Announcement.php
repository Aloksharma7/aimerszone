<?php

namespace App\Models;

use App\Enums\AnnouncementAudience;
use App\Enums\AnnouncementStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Announcement extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $fillable = [
        'title', 'summary', 'body', 'audience', 'course_id', 'batch_id', 'role_key',
        'channel', 'status', 'publish_at', 'published_at', 'pinned', 'link', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'audience' => AnnouncementAudience::class,
            'status' => AnnouncementStatus::class,
            'publish_at' => 'datetime',
            'published_at' => 'datetime',
            'pinned' => 'boolean',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function readers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'announcement_reads')->withPivot('read_at');
    }

    public function scopePublished($query)
    {
        return $query->where('status', AnnouncementStatus::Published->value)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }

    /**
     * Restricts a published announcement feed to what one student may see:
     * institution-wide notices plus notices for batches they hold a seat in.
     *
     * @param  array<int, string>  $batchIds
     * @param  array<int, string>  $courseIds
     */
    public function scopeForStudent($query, array $batchIds, array $courseIds)
    {
        return $query->where(function ($builder) use ($batchIds, $courseIds) {
            $builder->where('audience', AnnouncementAudience::All->value)
                ->orWhere(fn ($q) => $q->where('audience', AnnouncementAudience::Role->value)->where('role_key', 'student'))
                ->orWhere(fn ($q) => $q->where('audience', AnnouncementAudience::Batch->value)->whereIn('batch_id', $batchIds ?: ['-']))
                ->orWhere(fn ($q) => $q->where('audience', AnnouncementAudience::Course->value)->whereIn('course_id', $courseIds ?: ['-']));
        });
    }

    /**
     * Restricts to what a non-student portal (teacher/staff/admin) may see:
     * institution-wide notices plus notices addressed to their specific
     * role. Batch/course-targeted announcements are a student-facing
     * concept only — the admin composer's "one batch" audience means "that
     * batch's students," not that batch's teacher, so those are
     * deliberately excluded here rather than guessed at.
     *
     * AnnouncementAudience::Role is generic (not restricted to students),
     * and the composer really does let an admin target "teacher"/"staff"/
     * "admin" — but until this scope existed, nothing outside
     * Student\NotificationController ever read the Announcement model at
     * all, so a role-targeted announcement for any other role reached
     * nobody: it existed in the database and the admin's own history list,
     * and nowhere else.
     */
    public function scopeForRole($query, string $roleKey)
    {
        return $query->where(function ($builder) use ($roleKey) {
            $builder->where('audience', AnnouncementAudience::All->value)
                ->orWhere(fn ($q) => $q->where('audience', AnnouncementAudience::Role->value)->where('role_key', $roleKey));
        });
    }
}
