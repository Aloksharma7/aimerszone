<?php

namespace App\Http\Controllers\Api\V1\Staff;

use App\Enums\RoleKey;
use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\StudentSupportAction;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\UserDirectory;
use App\Support\ApiResponse;
use App\Support\CsvStream;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Student onboarding and account assistance for the enrollment office.
 *
 * Officers can create accounts and start audited support actions, but never
 * see or set a password themselves — a reset link or a one-time temporary
 * password is issued, and the temporary password forces a change at first use.
 */
class StudentController extends Controller
{
    public function __construct(
        protected UserDirectory $directory,
        protected AuditLogger $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $students = User::query()
            ->withRole(RoleKey::Student)
            ->search($request->string('q')->value())
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
            ->orderBy('name')
            ->paginate($this->perPage(100));

        $this->attachCurrentCourse($students->getCollection());

        return ApiResponse::paginated($students, fn (User $student) => $this->payload($student));
    }

    public function show(Request $request, User $student): JsonResponse
    {
        abort_unless($student->hasRole(RoleKey::Student), 404);

        $this->attachCurrentCourse(collect([$student]));

        return ApiResponse::item($this->payload($student));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'mobile' => ['required', 'string', 'min:7', 'max:20', 'regex:/^\+?[0-9\s-]+$/', Rule::unique('users', 'mobile')->whereNull('deleted_at')],
            'email' => ['nullable', 'email:filter', 'max:190', Rule::unique('users', 'email')->whereNull('deleted_at')],
            'preferred_language' => ['nullable', Rule::in(['en', 'ne'])],
            'password_setup_method' => ['required', Rule::in(['link', 'temporary'])],
            'inquiry' => ['nullable', 'string', 'max:255'],
            'internal_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $temporary = $data['password_setup_method'] === 'temporary' ? Str::password(12) : null;

        $student = $this->directory->createStudent([
            'name' => $data['name'],
            'mobile' => $data['mobile'],
            'email' => $data['email'] ?? null,
            'password' => $temporary ?? Str::password(24),
            'locale' => $data['preferred_language'] ?? 'en',

            // Either path ends with the student choosing their own password.
            'must_change_password' => true,
        ], $request->user());

        if ($data['password_setup_method'] === 'link' && filled($student->email)) {
            Password::sendResetLink(['email' => $student->email]);
        }

        if (filled($data['internal_note'] ?? null) || filled($data['inquiry'] ?? null)) {
            StudentSupportAction::create([
                'user_id' => $student->getKey(),
                'action' => 'onboarding_note',
                'note' => $data['internal_note'] ?? null,
                'payload' => ['inquiry' => $data['inquiry'] ?? null],
                'performed_by' => $request->user()->getKey(),
            ]);
        }

        $this->audit->log('student.created', $student, $request->user(), properties: [
            'setup' => $data['password_setup_method'],
        ]);

        return ApiResponse::item(array_filter([
            'id' => $student->id,
            'student_code' => $student->student_code,

            // Shown once so the officer can read it to the student in person;
            // it is never stored anywhere retrievable.
            'temporary_password' => $temporary,
        ]), status: 201);
    }

    /** password-reset | contact-correction | revoke-sessions */
    public function supportAction(Request $request, User $student): JsonResponse
    {
        abort_unless($student->hasRole(RoleKey::Student), 404);

        $data = $request->validate([
            'action' => ['required', Rule::in(['password-reset', 'contact-correction', 'revoke-sessions'])],
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        $outcome = match ($data['action']) {
            'password-reset' => $this->startPasswordReset($student),
            'revoke-sessions' => $this->revokeSessions($student),

            // A contact change is recorded for an authorized reviewer rather
            // than applied straight away, since it can redirect a reset link.
            'contact-correction' => 'recorded_for_review',
        };

        $record = StudentSupportAction::create([
            'user_id' => $student->getKey(),
            'action' => str_replace('-', '_', $data['action']),
            'note' => $data['reason'],
            'payload' => ['outcome' => $outcome],
            'performed_by' => $request->user()->getKey(),
        ]);

        $this->audit->log('student.support_'.str_replace('-', '_', $data['action']), $student, $request->user(), $data['reason']);

        return ApiResponse::item(['id' => $record->id, 'outcome' => $outcome]);
    }

    public function export(Request $request): StreamedResponse
    {
        $this->audit->log('export.generated', actor: $request->user(), properties: ['dataset' => 'staff-students'], targetLabel: 'Export: students');

        $query = User::query()->withRole(RoleKey::Student)->orderBy('name');

        return CsvStream::fromQuery(
            $query,
            ['Student code', 'Name', 'Mobile', 'Email', 'Status', 'Joined'],
            fn (User $student) => [
                $student->student_code,
                $student->name,
                $student->mobile,
                $student->email,
                $student->status->value,
                $student->created_at,
            ],
            'students-'.now()->format('Y-m-d').'.csv',
        );
    }

    protected function startPasswordReset(User $student): string
    {
        if (blank($student->email)) {
            return 'no_email_on_file';
        }

        Password::sendResetLink(['email' => $student->email]);

        return 'reset_link_sent';
    }

    protected function revokeSessions(User $student): string
    {
        if (config('session.driver') === 'database') {
            DB::table(config('session.table', 'sessions'))->where('user_id', $student->getKey())->delete();
        }

        return 'sessions_revoked';
    }

    /** One query for the whole page rather than one per student. */
    protected function attachCurrentCourse($students): void
    {
        $titles = Enrollment::query()
            ->whereIn('user_id', $students->pluck('id'))
            ->accessible()
            ->with('course:id,title')
            ->get()
            ->groupBy('user_id')
            ->map(fn ($group) => $group->first()?->course?->title);

        $students->each(fn (User $student) => $student->setAttribute(
            'current_course_title',
            $titles[$student->getKey()] ?? null,
        ));
    }

    protected function payload(User $student): array
    {
        return [
            'id' => $student->id,
            'name' => $student->name,
            'mobile' => $student->mobile ?? '',
            'email' => $student->email,
            'student_code' => $student->student_code,
            'status' => $student->status->value,
            'current_course_title' => $student->getAttribute('current_course_title'),
            'joined_at' => $student->created_at?->toIso8601String(),
        ];
    }
}
