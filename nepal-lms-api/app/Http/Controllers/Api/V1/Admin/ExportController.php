<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\AuditLog;
use App\Models\Batch;
use App\Models\Course;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\CsvStream;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * CSV exports for the administrator lists and reports.
 *
 * Every export is itself audited: knowing who pulled a full student or finance
 * extract, and when, matters as much as the access control that allowed it.
 */
class ExportController extends Controller
{
    public function __construct(protected AuditLogger $audit) {}

    public function users(Request $request): StreamedResponse
    {
        $this->record($request, 'users');

        $query = User::query()->with('roles:id,key,name')->orderBy('name');

        return CsvStream::fromQuery(
            $query,
            ['Name', 'Email', 'Mobile', 'Student code', 'Primary role', 'Status', 'MFA', 'Last seen'],
            fn (User $user) => [
                $user->name,
                $user->email,
                $user->mobile,
                $user->student_code,
                $user->primaryRoleKey()?->label() ?? 'None',
                $user->status->value,
                $user->hasTwoFactorEnabled(),
                $user->last_seen_at,
            ],
            'users-'.now()->format('Y-m-d').'.csv',
        );
    }

    public function courses(Request $request): StreamedResponse
    {
        $this->record($request, 'courses');

        $query = Course::query()->with('category:id,name')->withCount('batches')->orderBy('title');

        return CsvStream::fromQuery(
            $query,
            ['Title', 'Code', 'Category', 'Access type', 'Price NPR', 'Status', 'Published', 'Batches', 'Updated'],
            fn (Course $course) => [
                $course->title,
                $course->code,
                $course->category?->name,
                $course->access_type->value,
                $course->price_npr,
                $course->status->value,
                $course->published,
                $course->batches_count,
                $course->updated_at,
            ],
            'courses-'.now()->format('Y-m-d').'.csv',
        );
    }

    public function batches(Request $request): StreamedResponse
    {
        $this->record($request, 'batches');

        $query = Batch::query()
            ->with(['course:id,title', 'teachers:id,name'])
            ->withCount(['enrollments as students_count' => fn ($builder) => $builder->accessible()])
            ->orderByDesc('start_at');

        return CsvStream::fromQuery(
            $query,
            ['Batch', 'Course', 'Teacher', 'Schedule', 'Students', 'Capacity', 'Start', 'End', 'Status'],
            fn (Batch $batch) => [
                $batch->title,
                $batch->course?->title,
                $batch->teachers->pluck('name')->implode(', '),
                $batch->schedule_summary,
                $batch->students_count,
                $batch->capacity,
                $batch->start_at,
                $batch->end_at,
                $batch->status->value,
            ],
            'batches-'.now()->format('Y-m-d').'.csv',
        );
    }

    public function announcements(Request $request): StreamedResponse
    {
        $this->record($request, 'announcements');

        $query = Announcement::query()
            ->with(['course:id,title', 'batch:id,title', 'author:id,name'])
            ->orderByDesc('created_at');

        return CsvStream::fromQuery(
            $query,
            ['Title', 'Audience', 'Course', 'Batch', 'Channel', 'Status', 'Published', 'Author'],
            fn (Announcement $announcement) => [
                $announcement->title,
                $announcement->audience->value,
                $announcement->course?->title,
                $announcement->batch?->title,
                $announcement->channel,
                $announcement->status->value,
                $announcement->published_at,
                $announcement->author?->name,
            ],
            'announcements-'.now()->format('Y-m-d').'.csv',
        );
    }

    public function auditLogs(Request $request): StreamedResponse
    {
        $this->record($request, 'audit-logs');

        /*
         * The button is labelled "Export filtered log", so it uses exactly the
         * filters the list applied. Previously action_group was matched as a
         * literal action prefix ("payments.%"), which is not an action any
         * writer emits, so choosing a group exported nothing at all.
         */
        $query = app(AuditLogController::class)
            ->filtered($request)
            ->orderByDesc('occurred_at');

        return CsvStream::fromQuery(
            $query,
            ['Occurred at', 'Actor', 'Action', 'Target', 'Reason', 'IP', 'Request id'],
            fn (AuditLog $entry) => [
                $entry->occurred_at,
                $entry->actor_label,
                $entry->action,
                $entry->target_label,
                $entry->reason,
                $entry->ip_address,
                $entry->request_id,
            ],
            'audit-logs-'.now()->format('Y-m-d').'.csv',
        );
    }

    /** Reuses the report controller so the CSV can never drift from the table. */
    public function report(Request $request, ReportController $reports, string $report): StreamedResponse
    {
        abort_unless(in_array($report, ['academic', 'enrollments', 'finance'], true), 404);

        $this->record($request, 'report:'.$report);

        $payload = $reports->{$report === 'enrollments' ? 'enrollments' : $report}($request)->getData(true);
        $rows = $payload['data'] ?? [];

        $headers = $rows === [] ? ['No data'] : array_map(
            fn (string $key) => ucfirst(preg_replace('/(?<!^)[A-Z]/', ' $0', $key)),
            array_keys($rows[0]),
        );

        return CsvStream::fromRows($rows, $headers, $report.'-report-'.now()->format('Y-m-d').'.csv');
    }

    protected function record(Request $request, string $dataset): void
    {
        $this->audit->log('export.generated', actor: $request->user(), properties: [
            'dataset' => $dataset,
            'filters' => $request->query(),
        ], targetLabel: 'Export: '.$dataset);
    }
}
