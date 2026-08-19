<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Faq;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * FAQ content management.
 *
 * FAQs were readable through the public site and the student support page,
 * but the only way one ever existed was DemoContentSeeder — a one-time
 * database seed. An institution could not add, edit or remove a single
 * question after launch without a database console.
 */
class FaqController extends Controller
{
    public function __construct(protected AuditLogger $audit) {}

    /** Includes unpublished entries, which the public endpoint hides. */
    public function index(Request $request): JsonResponse
    {
        $faqs = Faq::query()
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get();

        return ApiResponse::collection($faqs->map(fn (Faq $faq) => [
            'id' => $faq->id,
            'question' => $faq->question,
            'answer' => $faq->answer,
            'category' => $faq->category,
            'sort_order' => (int) $faq->sort_order,
            'is_published' => (bool) $faq->is_published,
        ]));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $faq = Faq::create(array_merge($data, [
            'category' => $data['category'] ?? 'general',
            'is_published' => $data['is_published'] ?? true,
        ]));

        $this->audit->log('faq.created', $faq, $request->user(), targetLabel: $faq->question);

        return ApiResponse::item(['id' => $faq->id], status: 201);
    }

    public function update(Request $request, Faq $faq): JsonResponse
    {
        $data = $this->validated($request, $faq);

        $faq->fill($data)->save();

        $this->audit->log('faq.updated', $faq, $request->user(), properties: [
            'fields' => array_keys($data),
        ], targetLabel: $faq->question);

        return ApiResponse::item(['id' => $faq->id]);
    }

    public function destroy(Request $request, Faq $faq): JsonResponse
    {
        $this->audit->log('faq.deleted', $faq, $request->user(), targetLabel: $faq->question);
        $faq->delete();

        return ApiResponse::message('FAQ removed.');
    }

    protected function validated(Request $request, ?Faq $existing = null): array
    {
        return $request->validate([
            'question' => [$existing ? 'sometimes' : 'required', 'string', 'min:5', 'max:255'],
            'answer' => [$existing ? 'sometimes' : 'required', 'string', 'min:5', 'max:5000'],
            'category' => ['sometimes', 'string', 'max:40'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:999'],
            'is_published' => ['sometimes', 'boolean'],
        ]);
    }
}
