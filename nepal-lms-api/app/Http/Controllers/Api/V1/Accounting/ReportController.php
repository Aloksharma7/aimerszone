<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Support\ApiResponse;
use App\Support\CsvStream;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Collections (money received) and outstanding (money expected but not settled).
 */
class ReportController extends Controller
{
    public function __construct(protected AuditLogger $audit) {}

    public function collections(Request $request): JsonResponse
    {
        [$from, $to] = $this->window($request);

        $approved = fn () => Payment::query()->approved()->whereBetween('reviewed_at', [$from, $to]);

        $monthTotal = (int) Payment::query()->approved()->where('reviewed_at', '>=', now()->startOfMonth())->sum('submitted_amount_npr');
        $monthCount = Payment::query()->approved()->where('reviewed_at', '>=', now()->startOfMonth())->count();

        // Grouped by the database rather than in PHP: a wide date range would
        // otherwise pull every payment row into memory just to sum it.
        $byMethod = Payment::query()
            ->approved()
            ->whereBetween('reviewed_at', [$from, $to])
            ->leftJoin('payment_methods', 'payments.payment_method_id', '=', 'payment_methods.id')
            ->groupBy('payment_methods.name')
            ->selectRaw('payment_methods.name as label, sum(payments.submitted_amount_npr) as total')
            ->pluck('total', 'label')
            ->mapWithKeys(fn ($total, $label) => [$label ?: 'Not recorded' => (int) $total]);

        $byCourse = Payment::query()
            ->approved()
            ->whereBetween('reviewed_at', [$from, $to])
            ->leftJoin('courses', 'payments.course_id', '=', 'courses.id')
            ->groupBy('courses.title')
            ->selectRaw('courses.title as label, sum(payments.submitted_amount_npr) as total')
            ->pluck('total', 'label')
            ->mapWithKeys(fn ($total, $label) => [$label ?: 'Course removed' => (int) $total]);

        $windowTotal = max(1, (int) $byMethod->sum());

        return ApiResponse::item([
            'metrics' => [
                'today_npr' => (int) Payment::query()->approved()->whereDate('reviewed_at', today())->sum('submitted_amount_npr'),
                'today_count' => Payment::query()->approved()->whereDate('reviewed_at', today())->count(),
                'week_npr' => (int) Payment::query()->approved()->where('reviewed_at', '>=', now()->startOfWeek())->sum('submitted_amount_npr'),
                'week_count' => Payment::query()->approved()->where('reviewed_at', '>=', now()->startOfWeek())->count(),
                'month_npr' => $monthTotal,
                'month_count' => $monthCount,

                // Average value of an approved payment, not a daily average.
                'average_npr' => $monthCount > 0 ? (int) round($monthTotal / $monthCount) : 0,
            ],
            'methods' => $byMethod->map(fn (int $amount, string $name) => [
                'name' => $name,
                'amount_npr' => $amount,
                'share_percent' => (int) round($amount / $windowTotal * 100),
            ])->values()->all(),
            'courses' => $byCourse->sortDesc()->take(10)->map(fn (int $amount, string $name) => [
                'name' => $name,
                'amount_npr' => $amount,
                'share_percent' => (int) round($amount / $windowTotal * 100),
            ])->values()->all(),
        ]);
    }

    /**
     * Anything expected but not settled: submissions still awaiting review,
     * rejected payments the student has not replaced, and short payments.
     */
    public function outstanding(Request $request): JsonResponse
    {
        $rows = $this->outstandingRows();

        return ApiResponse::item([
            'items' => $rows->values()->all(),
            'metrics' => [
                'under_review' => $rows->where('issue', 'Awaiting review')->count(),
                'mismatches' => $rows->where('issue', 'Short payment')->count(),

                // Rejected and never replaced: the student intended to pay but
                // no usable evidence is on file.
                'intent_only' => $rows->where('issue', 'Rejected, awaiting resubmission')->count(),
            ],
        ]);
    }

    public function exportCollections(Request $request): StreamedResponse
    {
        $this->audit->log('export.generated', actor: $request->user(), properties: ['dataset' => 'collections'], targetLabel: 'Export: collections');

        [$from, $to] = $this->window($request);

        $query = Payment::query()
            ->approved()
            ->with(['user:id,name,student_code', 'course:id,title', 'method:id,name'])
            ->whereBetween('reviewed_at', [$from, $to])
            ->orderByDesc('reviewed_at');

        return CsvStream::fromQuery(
            $query,
            ['Payment', 'Student code', 'Student', 'Course', 'Method', 'Amount', 'Reference', 'Approved at'],
            fn (Payment $payment) => [
                $payment->id,
                $payment->user?->student_code,
                $payment->user?->name,
                $payment->course?->title,
                $payment->method?->name,
                $payment->submitted_amount_npr,
                $payment->transaction_reference,
                $payment->reviewed_at,
            ],
            'collections-'.now()->format('Y-m-d').'.csv',
        );
    }

    public function exportOutstanding(Request $request): StreamedResponse
    {
        $this->audit->log('export.generated', actor: $request->user(), properties: ['dataset' => 'outstanding'], targetLabel: 'Export: outstanding');

        return CsvStream::fromRows(
            $this->outstandingRows()->map(fn (array $row) => [
                $row['student_name'],
                $row['course_title'],
                $row['expected_amount_npr'],
                $row['submitted_amount_npr'],
                $row['issue'],
                $row['age_label'],
            ]),
            ['Student', 'Course', 'Expected', 'Paid', 'Issue', 'Age'],
            'outstanding-'.now()->format('Y-m-d').'.csv',
        );
    }

    protected function outstandingRows()
    {
        return Payment::query()
            ->whereIn('status', ['submitted', 'under_review', 'rejected'])
            ->with(['user:id,name', 'course:id,title'])
            ->orderBy('submitted_at')

            // Capped deliberately: this is a worklist, not an export. The CSV
            // export is the route for a complete picture.
            ->limit(500)
            ->get()
            ->map(fn (Payment $payment) => [
                'student_id' => $payment->user_id,
                'student_name' => $payment->user?->name ?? 'Removed account',
                'course_title' => $payment->course?->title ?? 'Course removed',
                'expected_amount_npr' => (int) $payment->expected_amount_npr,
                'submitted_amount_npr' => (int) $payment->submitted_amount_npr,
                'issue' => match (true) {
                    $payment->status->value === 'rejected' => 'Rejected, awaiting resubmission',
                    $payment->submitted_amount_npr < $payment->expected_amount_npr => 'Short payment',
                    default => 'Awaiting review',
                },
                'age_label' => $payment->submitted_at?->diffForHumans() ?? 'Not submitted',
            ]);
    }

    /** @return array{0: Carbon, 1: Carbon} */
    protected function window(Request $request): array
    {
        $to = $request->filled('to') ? Carbon::parse($request->string('to')->value()) : now();
        $from = $request->filled('from') ? Carbon::parse($request->string('from')->value()) : $to->copy()->startOfMonth();

        if ($from->gt($to)) {
            [$from, $to] = [$to, $from];
        }

        $limit = $to->copy()->subMonths(24);

        return [$from->lt($limit) ? $limit : $from, $to];
    }
}
