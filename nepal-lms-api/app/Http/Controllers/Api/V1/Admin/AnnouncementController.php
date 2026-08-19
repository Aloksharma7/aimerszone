<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\AnnouncementAudience;
use App\Enums\AnnouncementStatus;
use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AnnouncementController extends Controller
{
    public function __construct(protected AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        $announcements = Announcement::query()
            ->with(['course:id,title', 'batch:id,title', 'author:id,name'])
            ->orderByDesc('created_at')
            ->limit($this->perPage(100))
            ->get();

        $scheduled = Announcement::query()
            ->where('status', AnnouncementStatus::Scheduled->value)
            ->where('publish_at', '>', now())
            ->orderBy('publish_at');

        return ApiResponse::item([
            'items' => $announcements->map(fn (Announcement $announcement) => [
                'id' => $announcement->id,
                'title' => $announcement->title,
                'audience_label' => $this->audienceLabel($announcement),
                'author_name' => $announcement->author?->name ?? 'System',
                'channel_label' => ucfirst($announcement->channel),
                'scheduled_label' => $this->scheduleLabel($announcement),
                'status' => $announcement->status->value,
            ])->all(),
            'metrics' => [
                'published_month' => Announcement::query()
                    ->where('status', AnnouncementStatus::Published->value)
                    ->where('published_at', '>=', now()->startOfMonth())
                    ->count(),
                'scheduled' => (clone $scheduled)->count(),
                'next_scheduled_label' => (clone $scheduled)->value('publish_at')?->toIso8601String() ?? 'None scheduled',

                // Portal delivery is in-app, so anything published is delivered.
                // This becomes meaningful once email or SMS channels are wired.
                'delivery_rate_percent' => 100,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:180'],
            'summary' => ['nullable', 'string', 'max:500'],
            'body' => ['required', 'string', 'max:20000'],
            'audience' => ['required', Rule::in(AnnouncementAudience::values())],
            'course_id' => ['required_if:audience,course', 'nullable', 'string', Rule::exists('courses', 'id')],
            'batch_id' => ['required_if:audience,batch', 'nullable', 'string', Rule::exists('batches', 'id')],
            'role_key' => ['required_if:audience,role', 'nullable', 'string', 'max:40'],
            'channel' => ['nullable', Rule::in(['portal', 'email', 'sms', 'whatsapp'])],
            'publish_at' => ['nullable', 'date'],
            'pinned' => ['nullable', 'boolean'],
            'link' => ['nullable', 'string', 'max:255'],
        ]);

        // A future publish_at schedules; anything else publishes immediately.
        $scheduled = filled($data['publish_at'] ?? null) && now()->lt($data['publish_at']);

        $announcement = Announcement::create(array_merge($data, [
            'channel' => $data['channel'] ?? 'portal',
            'status' => $scheduled ? AnnouncementStatus::Scheduled->value : AnnouncementStatus::Published->value,
            'published_at' => $scheduled ? null : now(),
            'created_by' => $request->user()->getKey(),
        ]));

        $this->audit->log('announcement.created', $announcement, $request->user(), properties: [
            'audience' => $data['audience'],
            'scheduled' => $scheduled,
        ]);

        return ApiResponse::item(['id' => $announcement->id, 'status' => $announcement->status->value], status: 201);
    }

    public function update(Request $request, Announcement $announcement): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'min:3', 'max:180'],
            'summary' => ['sometimes', 'nullable', 'string', 'max:500'],
            'body' => ['sometimes', 'string', 'max:20000'],
            'pinned' => ['sometimes', 'boolean'],
            'status' => ['sometimes', Rule::in(AnnouncementStatus::values())],
        ]);

        if (($data['status'] ?? null) === AnnouncementStatus::Published->value && $announcement->published_at === null) {
            $data['published_at'] = now();
        }

        $announcement->fill($data)->save();

        $this->audit->log('announcement.updated', $announcement, $request->user());

        return ApiResponse::item(['id' => $announcement->id]);
    }

    protected function audienceLabel(Announcement $announcement): string
    {
        return match ($announcement->audience) {
            AnnouncementAudience::Course => 'Course: '.($announcement->course?->title ?? 'Removed'),
            AnnouncementAudience::Batch => 'Batch: '.($announcement->batch?->title ?? 'Removed'),
            AnnouncementAudience::Role => 'Role: '.str_replace('_', ' ', (string) $announcement->role_key),
            default => 'Everyone',
        };
    }

    protected function scheduleLabel(Announcement $announcement): string
    {
        if ($announcement->status === AnnouncementStatus::Scheduled && $announcement->publish_at) {
            return $announcement->publish_at->toIso8601String();
        }

        return $announcement->published_at?->toIso8601String() ?? 'Not scheduled';
    }
}
