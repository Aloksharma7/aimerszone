<?php

namespace Database\Seeders;

use App\Enums\BatchStatus;
use App\Enums\ClassSessionStatus;
use App\Enums\RoleKey;
use App\Enums\UserStatus;
use App\Models\Batch;
use App\Models\Category;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Faq;
use App\Models\Recording;
use App\Models\SyllabusLesson;
use App\Models\SyllabusModule;
use App\Models\TeacherProfile;
use App\Models\User;
use App\Services\PaymentDecisionService;
use App\Services\UserDirectory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Optional sample institution so every screen has something real to show
 * before staff start entering their own data.
 *
 *   php artisan db:seed --class=Database\\Seeders\\DemoContentSeeder
 *
 * Never run automatically: DatabaseSeeder does not call this, so a production
 * install cannot end up with demo students by accident. Every account it
 * creates uses the password below and is flagged to change it at first sign-in.
 */
class DemoContentSeeder extends Seeder
{
    protected const PASSWORD = 'Demo12345';

    public function run(UserDirectory $directory, PaymentDecisionService $decisions): void
    {
        if (app()->isProduction() && ! $this->command?->confirm('This is a production environment. Really seed demo content?')) {
            $this->command?->warn('Skipped.');

            return;
        }

        $category = Category::firstOrCreate(
            ['slug' => 'management'],
            ['name' => 'Management', 'description' => 'Bachelor and master level management programmes.', 'is_active' => true],
        );

        $teacher = $this->staff(RoleKey::Teacher, 'teacher@example.test', 'Sita Sharma', $directory);
        $staffMember = $this->staff(RoleKey::Staff, 'staff@example.test', 'Ram Thapa', $directory);

        TeacherProfile::firstOrCreate(['user_id' => $teacher->getKey()], [
            'slug' => 'sita-sharma',
            'headline' => 'Microeconomics Faculty',
            'subjects' => ['Microeconomics', 'Statistics'],
            'experience_summary' => 'Twelve years teaching BBS and BBA economics.',
            'bio' => 'Sita has taught economics at bachelor level since 2014 and focuses on numerical practice.',
            'is_public' => true,
        ]);

        $course = Course::firstOrCreate(['slug' => 'bbs-microeconomics'], [
            'category_id' => $category->getKey(),
            'code' => 'BBS-MICRO',
            'title' => 'BBS First Year Microeconomics',
            'short_description' => 'Live classes, recordings and weekly tests for BBS first year microeconomics.',
            'description' => 'A full-length microeconomics course covering demand, supply, elasticity, production and market structures, with weekly numerical practice.',
            'access_type' => 'paid',
            'price_npr' => 5500,
            'original_price_npr' => 7000,
            'features' => ['Live', 'Recordings', 'Tests', 'Notes'],
            'published' => true,
            'published_at' => now(),
            'status' => 'published',
            'owner_id' => $staffMember->getKey(),
        ]);

        $free = Course::firstOrCreate(['slug' => 'study-skills-orientation'], [
            'category_id' => $category->getKey(),
            'code' => 'FREE-ORIENT',
            'title' => 'Free Study Skills Orientation',
            'short_description' => 'A short free orientation on planning, note taking and exam preparation.',
            'access_type' => 'free',
            'price_npr' => 0,
            'features' => ['Recordings', 'Notes'],
            'published' => true,
            'published_at' => now(),
            'status' => 'published',
        ]);

        $this->syllabus($course);

        $batch = Batch::firstOrCreate(['code' => 'BBS-MICRO-EVE'], [
            'course_id' => $course->getKey(),
            'title' => 'Evening Batch',
            'public_id' => (string) Str::uuid(),
            'status' => BatchStatus::Ongoing->value,
            'start_at' => now()->subWeeks(3),
            'end_at' => now()->addMonths(2),
            'access_until' => now()->addMonths(8),
            'schedule_summary' => 'Sunday to Thursday, 6:00 PM - 7:30 PM',
            'schedule_days' => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
            'price_npr' => 5500,
            'capacity' => 60,
        ]);

        $batch->teachers()->syncWithoutDetaching([$teacher->getKey() => ['is_lead' => true]]);

        Batch::firstOrCreate(['code' => 'FREE-ORIENT-SELF'], [
            'course_id' => $free->getKey(),
            'title' => 'Self-paced',
            'public_id' => (string) Str::uuid(),
            'status' => BatchStatus::Open->value,
            'start_at' => now()->subMonth(),
            'access_until' => now()->addYear(),
            'schedule_summary' => 'Study at your own pace',
            'price_npr' => 0,
        ]);

        $this->sessions($batch, $teacher);
        $this->recordings($batch);
        $this->faqs();

        // Two students: one already enrolled, one with a payment still waiting
        // in the accountant's queue, so both states are visible on day one.
        $enrolled = $this->student('student@example.test', 'Anisha Yadav', '9800000001', $directory);
        $pending = $this->student('applicant@example.test', 'Bikash Mandal', '9800000002', $directory);

        $payment = \App\Models\Payment::firstOrCreate(
            ['user_id' => $enrolled->getKey(), 'batch_id' => $batch->getKey()],
            [
                'course_id' => $course->getKey(),
                'payment_method_id' => \App\Models\PaymentMethod::where('key', 'esewa')->value('id'),
                'status' => 'submitted',
                'expected_amount_npr' => 5500,
                'submitted_amount_npr' => 5500,
                'payer_name' => 'Anisha Yadav',
                'transaction_reference' => 'ESW'.random_int(100000, 999999),
                'paid_at' => now()->subDays(4),
                'submitted_at' => now()->subDays(4),
                'submitted_by' => $enrolled->getKey(),
            ],
        );

        // Approved through the real service, so the enrollment, receipt and
        // audit entry are created exactly as they would be in production.
        if ($payment->isReviewable()) {
            $decisions->approve($payment, $staffMember, 'Demo data');
        }

        \App\Models\Payment::firstOrCreate(
            ['user_id' => $pending->getKey(), 'batch_id' => $batch->getKey()],
            [
                'course_id' => $course->getKey(),
                'payment_method_id' => \App\Models\PaymentMethod::where('key', 'khalti')->value('id'),
                'status' => 'submitted',
                'expected_amount_npr' => 5500,
                'submitted_amount_npr' => 5000,
                'payer_name' => 'Bikash Mandal',
                'transaction_reference' => 'KHL'.random_int(100000, 999999),
                'paid_at' => now()->subDay(),
                'submitted_at' => now()->subDay(),
                'submitted_by' => $pending->getKey(),
                'risk_label' => 'short_payment',
            ],
        );

        $this->report();
    }

    protected function staff(RoleKey $role, string $email, string $name, UserDirectory $directory): User
    {
        $user = User::firstOrCreate(['email' => $email], [
            'name' => $name,
            'password' => self::PASSWORD,
            'status' => UserStatus::Active->value,
            'must_change_password' => true,
            'staff_code' => Str::upper(Str::substr($role->value, 0, 3)).'-'.random_int(1000, 9999),
        ]);

        $user->forceFill(['email_verified_at' => now()])->save();

        $directory->assignRole($user, $role, primary: true);

        return $user->fresh();
    }

    protected function student(string $email, string $name, string $mobile, UserDirectory $directory): User
    {
        $existing = User::where('email', $email)->first();

        if ($existing !== null) {
            return $existing;
        }

        return $directory->createStudent([
            'name' => $name,
            'email' => $email,
            'mobile' => $mobile,
            'password' => self::PASSWORD,
            'must_change_password' => true,
            'terms_accepted' => true,
        ]);
    }

    protected function syllabus(Course $course): void
    {
        $modules = [
            'Demand and Supply' => ['Law of demand', 'Law of supply', 'Market equilibrium'],
            'Elasticity' => ['Price elasticity of demand', 'Income elasticity', 'Numerical practice'],
            'Production and Cost' => ['Production function', 'Short run costs', 'Long run costs'],
        ];

        $order = 0;

        foreach ($modules as $title => $lessons) {
            $module = SyllabusModule::firstOrCreate(
                ['course_id' => $course->getKey(), 'title' => $title],
                ['order' => $order++],
            );

            foreach (array_values($lessons) as $index => $lesson) {
                SyllabusLesson::firstOrCreate(
                    ['syllabus_module_id' => $module->getKey(), 'title' => $lesson],
                    ['type' => 'Lesson', 'order' => $index],
                );
            }
        }
    }

    protected function sessions(Batch $batch, User $teacher): void
    {
        $topics = [
            ['Market Equilibrium Revision', now()->subDays(5), ClassSessionStatus::Completed],
            ['Price Elasticity of Demand', now()->subDays(2), ClassSessionStatus::Completed],
            ['Elasticity Numerical Practice', now()->addHours(6), ClassSessionStatus::Scheduled],
            ['Production Function Basics', now()->addDays(2), ClassSessionStatus::Scheduled],
        ];

        foreach ($topics as [$topic, $startsAt, $status]) {
            ClassSession::firstOrCreate(
                ['batch_id' => $batch->getKey(), 'topic' => $topic],
                [
                    'teacher_id' => $teacher->getKey(),
                    'status' => $status->value,
                    'starts_at' => $startsAt,
                    'ends_at' => (clone $startsAt)->addMinutes(90),
                    'provider' => 'zoom',
                    'zoom_sync_status' => 'pending',

                    // Past classes are finalized so attendance figures exist.
                    'attendance_finalized_at' => $status === ClassSessionStatus::Completed ? $startsAt->copy()->addHours(2) : null,
                ],
            );
        }
    }

    protected function recordings(Batch $batch): void
    {
        $items = [
            ['Market Equilibrium Revision', 'Demand and Supply', 3420],
            ['Price Elasticity of Demand', 'Elasticity', 4180],
        ];

        foreach ($items as [$title, $module, $duration]) {
            Recording::firstOrCreate(
                ['batch_id' => $batch->getKey(), 'title' => $title],
                [
                    'module_title' => $module,
                    'source' => 'youtube',

                    // Placeholder ids: replace with real unlisted uploads.
                    'youtube_video_id' => Str::random(11),

                    'duration_seconds' => $duration,
                    'recorded_at' => now()->subDays(3),
                    'released_at' => now()->subDays(2),
                    'state' => 'available',
                ],
            );
        }
    }

    protected function faqs(): void
    {
        $faqs = [
            ['How do I join a live class?' => 'Open your course workspace and use the join button. It becomes active shortly before the class starts.'],
            ['When will my payment be approved?' => 'Payments are reviewed by the accounts team on working days. You will see the status in the Payments page.'],
            ['Can I watch a class again?' => 'Yes. Recordings are published in your course workspace after each class.'],
        ];

        $order = 0;

        foreach ($faqs as $faq) {
            foreach ($faq as $question => $answer) {
                Faq::firstOrCreate(['question' => $question], [
                    'answer' => $answer,
                    'category' => 'general',
                    'sort_order' => $order++,
                    'is_published' => true,
                ]);
            }
        }
    }

    protected function report(): void
    {
        $this->command?->warn('Demo content seeded. All demo accounts use the password: '.self::PASSWORD);
        $this->command?->line('  teacher@example.test      Teacher');
        $this->command?->line('  staff@example.test        Staff');
        $this->command?->line('  student@example.test      Student with an active enrollment');
        $this->command?->line('  applicant@example.test    Student with a payment awaiting review');
        $this->command?->line('Each account must change its password at first sign-in.');
    }
}
