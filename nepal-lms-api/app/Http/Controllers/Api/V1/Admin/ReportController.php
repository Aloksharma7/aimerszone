<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Enrollment;
use App\Models\LedgerAdjustment;
use App\Models\Payment;
use App\Models\Refund;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Academic, enrollment and finance reporting.
 *
 * All three accept the same filter vocabulary the frontend allows
 * (from, to, course_id, batch_id, teacher_id, payment_method, source, status)
 * and return flat rows ready for the table and the CSV export.
 */
class ReportController extends Controller
{
    public function academic(Request $request): JsonResponse
    {
        $batches = Batch::query()
            ->with(['course:id,title'])
            ->withCount(['enrollments as students_count' => fn ($query) => $query->accessible()])
            ->when($request->filled('course_id'), fn ($query) => $query->where('course_id', $request->string('course_id')->value()))
            ->when($request->filled('batch_id'), fn ($query) => $query->whereKey($request->string('batch_id')->value()))
            ->when($request->filled('teacher_id'), fn ($query) => $query->whereHas(
                'teachers',
                fn ($builder) => $builder->where('users.id', $request->string('teacher_id')->value()),
            ))
            ->orderBy('title')
            ->get();

        // One grouped query for every batch on the page, rather than one query
        // per batch inside the loop.
        $aggregatesByBatch = Enrollment::query()
            ->whereIn('batch_id', $batches->pluck('id'))
            ->accessible()
            ->groupBy('batch_id')
            ->selectRaw('batch_id, avg(attendance_percent) a, avg(test_percent) t, avg(syllabus_percent) s, avg(recording_percent) r')
            ->get()
            ->keyBy('batch_id');

        // The follow-up threshold is per-batch (each batch's own average minus
        // 20 points), so it cannot be counted with one plain groupBy query —
        // instead this pulls every batch's attendance rows in a single query
        // and does the per-batch threshold comparison in memory, rather than
        // running one count() query per batch inside the loop below.
        $attendanceByBatch = Enrollment::query()
            ->whereIn('batch_id', $batches->pluck('id'))
            ->accessible()
            ->get(['batch_id', 'attendance_percent'])
            ->groupBy('batch_id');

        $rows = $batches->map(function (Batch $batch) use ($aggregatesByBatch, $attendanceByBatch) {
            $aggregates = $aggregatesByBatch->get($batch->getKey());

            $attendance = (int) round($aggregates->a ?? 0);
            $threshold = max(0, $attendance - 20);

            return [
                'id' => $batch->id,
                'batch' => ($batch->course?->title ?? 'Course').' · '.$batch->title,
                'students' => (int) $batch->students_count,
                'attendance' => $attendance.'%',
                'testAverage' => (int) round($aggregates->t ?? 0).'%',
                'syllabus' => (int) round($aggregates->s ?? 0).'%',
                'recordings' => (int) round($aggregates->r ?? 0).'%',

                // Students whose attendance is far enough below the batch
                // average to be worth a phone call.
                'followUp' => ($attendanceByBatch->get($batch->getKey()) ?? collect())
                    ->filter(fn ($row) => (float) $row->attendance_percent < $threshold)
                    ->count(),
            ];
        });

        return ApiResponse::collection($rows->values());
    }

    /** Grouped by month across the selected window; defaults to six months. */
    public function enrollments(Request $request): JsonResponse
    {
        [$from, $to] = $this->window($request, months: 6);

        $rows = collect();

        for ($cursor = $from->copy()->startOfMonth(); $cursor->lte($to); $cursor->addMonth()) {
            $start = $cursor->copy()->startOfMonth();
            $end = $cursor->copy()->endOfMonth();

            $created = Enrollment::query()->whereBetween('created_at', [$start, $end]);
            $payments = Payment::query()->whereBetween('submitted_at', [$start, $end]);

            $rows->push([
                'id' => $cursor->format('Y-m'),
                'period' => $cursor->format('M Y'),
                'new' => (clone $created)->count(),
                'approved' => (clone $payments)->where('status', PaymentStatus::Approved->value)->count(),
                'pending' => (clone $payments)->pendingReview()->count(),
                'rejected' => (clone $payments)->where('status', PaymentStatus::Rejected->value)->count(),
                // 'free' and 'staff' sources were written by the old, now-removed
                // enrollment-request approval path. A scholarship or waiver is
                // recorded as a zero-amount payment instead (source 'payment'),
                // so these two counts only reflect historical rows going forward.
                'free' => (clone $created)->where('source', 'free')->count(),
                'transfers' => (clone $created)->where('source', 'staff')->count(),
            ]);
        }

        return ApiResponse::collection($rows->values());
    }

    /** Grouped by day; defaults to the last 30 days. */
    public function finance(Request $request): JsonResponse
    {
        [$from, $to] = $this->window($request, days: 30);

        $method = $request->string('payment_method')->value();

        $rows = collect();

        for ($day = $from->copy()->startOfDay(); $day->lte($to); $day->addDay()) {
            $start = $day->copy()->startOfDay();
            $end = $day->copy()->endOfDay();

            $approved = Payment::query()
                ->approved()
                ->whereBetween('reviewed_at', [$start, $end])
                ->when(filled($method), fn ($query) => $query->whereHas(
                    'method',
                    fn ($builder) => $builder->where('key', $method),
                ));

            $gross = (int) (clone $approved)->sum('submitted_amount_npr');

            $refunds = (int) Refund::query()
                ->where('status', 'processed')
                ->whereBetween('processed_at', [$start, $end])
                ->sum('amount_npr');

            $adjustments = (int) LedgerAdjustment::query()
                ->whereBetween('created_at', [$start, $end])
                ->sum('amount_npr');

            $rows->push([
                'id' => $day->toDateString(),
                'date' => $day->toDateString(),
                'transactions' => (clone $approved)->count(),
                'gross' => $gross,
                'refunds' => $refunds,
                'adjustments' => $adjustments,
                'net' => $gross - $refunds + $adjustments,
                'pending' => Payment::query()->pendingReview()->whereBetween('submitted_at', [$start, $end])->count(),
            ]);
        }

        return ApiResponse::collection($rows->values()->reverse()->values());
    }

    /**
     * Resolves the reporting window, clamped so a hand-edited query string
     * cannot ask for an unbounded scan.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    protected function window(Request $request, int $months = 0, int $days = 0): array
    {
        $to = $request->filled('to') ? Carbon::parse($request->string('to')->value()) : now();

        $from = $request->filled('from')
            ? Carbon::parse($request->string('from')->value())
            : ($months > 0 ? $to->copy()->subMonths($months - 1) : $to->copy()->subDays($days - 1));

        if ($from->gt($to)) {
            [$from, $to] = [$to, $from];
        }

        $limit = $months > 0 ? $to->copy()->subMonths(36) : $to->copy()->subDays(370);

        return [$from->lt($limit) ? $limit : $from, $to];
    }
}
