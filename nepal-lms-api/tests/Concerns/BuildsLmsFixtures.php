<?php

namespace Tests\Concerns;

use App\Enums\AccessType;
use App\Enums\BatchStatus;
use App\Enums\CourseStatus;
use App\Enums\EnrollmentStatus;
use App\Enums\PaymentStatus;
use App\Enums\RoleKey;
use App\Enums\TestStatus;
use App\Enums\UserStatus;
use App\Models\Batch;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Recording;
use App\Models\Test;
use App\Models\TestOption;
use App\Models\TestQuestion;
use App\Models\User;
use App\Services\UserDirectory;
use Illuminate\Support\Str;

/**
 * Fixture helpers shared by the feature tests.
 *
 * Records are built through the real models and the real role seeder rather
 * than factories, so the tests exercise the same permission composition the
 * application actually ships with.
 */
trait BuildsLmsFixtures
{
    protected function seedPlatform(): void
    {
        $this->seed(\Database\Seeders\RolePermissionSeeder::class);
        $this->seed(\Database\Seeders\SettingsSeeder::class);
        $this->seed(\Database\Seeders\PaymentMethodSeeder::class);
    }

    protected function makeUser(RoleKey $role, array $attributes = []): User
    {
        $user = User::create(array_merge([
            'name' => Str::title($role->value).' '.Str::random(4),
            'email' => Str::lower(Str::random(10)).'@example.test',
            'mobile' => '98'.random_int(10000000, 99999999),
            'password' => 'password123',
            'status' => UserStatus::Active->value,
        ], $attributes));

        app(UserDirectory::class)->assignRole($user, $role, primary: true);

        return $user->fresh();
    }

    protected function makeCourse(array $attributes = []): Course
    {
        return Course::create(array_merge([
            'slug' => 'course-'.Str::lower(Str::random(6)),
            'code' => Str::upper(Str::random(8)),
            'title' => 'Test Course '.Str::random(4),
            'access_type' => AccessType::Paid->value,
            'price_npr' => 5000,
            'published' => true,
            'published_at' => now(),
            'status' => CourseStatus::Published->value,
        ], $attributes));
    }

    protected function makeBatch(Course $course, array $attributes = []): Batch
    {
        return Batch::create(array_merge([
            'course_id' => $course->getKey(),
            'title' => 'Batch '.Str::random(4),
            'code' => 'B-'.Str::upper(Str::random(8)),
            'public_id' => (string) Str::uuid(),
            'status' => BatchStatus::Open->value,
            'start_at' => now()->subWeek(),
            'end_at' => now()->addMonths(3),
            'price_npr' => 5000,
        ], $attributes));
    }

    protected function enroll(User $student, Batch $batch, array $attributes = []): Enrollment
    {
        return Enrollment::create(array_merge([
            'user_id' => $student->getKey(),
            'course_id' => $batch->course_id,
            'batch_id' => $batch->getKey(),
            'status' => EnrollmentStatus::Active->value,
            'access_start_at' => now()->subDay(),
            'access_end_at' => now()->addMonths(6),
            'source' => 'payment',
            'activated_at' => now(),
        ], $attributes));
    }

    protected function makeRecording(Batch $batch, array $attributes = []): Recording
    {
        return Recording::create(array_merge([
            'batch_id' => $batch->getKey(),
            'title' => 'Recording '.Str::random(4),
            'source' => 'youtube',
            'youtube_video_id' => Str::random(11),
            'state' => 'available',
            'released_at' => now()->subHour(),
        ], $attributes));
    }

    /** A published, currently-open test with one single-answer question. */
    protected function makeTest(Batch $batch, array $attributes = []): Test
    {
        $test = Test::create(array_merge([
            'batch_id' => $batch->getKey(),
            'course_id' => $batch->course_id,
            'title' => 'Assessment '.Str::random(4),
            'status' => TestStatus::Open->value,
            'opens_at' => now()->subHour(),
            'closes_at' => now()->addHours(3),
            'duration_minutes' => 30,
            'total_marks' => 2,
            'attempts_allowed' => 1,
            'pass_mark' => 1,
            'result_release' => 'after_close',
        ], $attributes));

        $question = TestQuestion::create([
            'test_id' => $test->getKey(),
            'order' => 0,
            'type' => 'single',
            'prompt' => 'Which option is correct?',
            'marks' => 2,
        ]);

        TestOption::create(['test_question_id' => $question->getKey(), 'order' => 0, 'label' => 'Right', 'is_correct' => true]);
        TestOption::create(['test_question_id' => $question->getKey(), 'order' => 1, 'label' => 'Wrong', 'is_correct' => false]);

        return $test->fresh();
    }

    protected function makePayment(User $student, Batch $batch, array $attributes = []): Payment
    {
        return Payment::create(array_merge([
            'user_id' => $student->getKey(),
            'course_id' => $batch->course_id,
            'batch_id' => $batch->getKey(),
            'payment_method_id' => PaymentMethod::first()?->getKey(),
            'status' => PaymentStatus::Submitted->value,
            'expected_amount_npr' => 5000,
            'submitted_amount_npr' => 5000,
            'payer_name' => 'Test Payer',
            'submitted_at' => now(),
            'submitted_by' => $student->getKey(),
        ], $attributes));
    }
}
