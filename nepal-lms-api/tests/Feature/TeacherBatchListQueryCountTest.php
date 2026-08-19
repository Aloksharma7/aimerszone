<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: batchPayload() ran a "next session" query and a "syllabus
 * average" query per batch inside the list mapper — on a teacher's batch
 * list this meant roughly 2 extra queries per batch, so the query count grew
 * linearly with how many batches a teacher taught. Both are now precomputed
 * once for the whole page (nextSessionsFor()/syllabusProgressFor()), so the
 * query count should stay flat as batch count grows, not scale with it.
 */
class TeacherBatchListQueryCountTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_the_teacher_batch_list_query_count_does_not_grow_with_the_number_of_batches(): void
    {
        $teacher = $this->makeUser(RoleKey::Teacher);

        $this->createTaughtBatches($teacher, 2);
        DB::enableQueryLog();
        $this->actingAs($teacher)->getJson('/api/v1/teacher/batches')->assertOk();
        $countWithTwo = count(DB::getQueryLog());
        DB::flushQueryLog();
        DB::disableQueryLog();

        $this->createTaughtBatches($teacher, 6);
        DB::enableQueryLog();
        $this->actingAs($teacher)->getJson('/api/v1/teacher/batches')->assertOk();
        $countWithEight = count(DB::getQueryLog());
        DB::flushQueryLog();
        DB::disableQueryLog();

        // Before the fix this scaled by roughly 2 queries per extra batch
        // (12 for the 6 extra batches here). A small, batch-count-independent
        // difference between two separate requests is normal noise; a growth
        // anywhere near that is the N+1 coming back.
        $this->assertLessThan(
            6,
            $countWithEight - $countWithTwo,
            "Query count grew from {$countWithTwo} (2 batches) to {$countWithEight} (8 batches) — this looks like an N+1 regression.",
        );
    }

    protected function createTaughtBatches(User $teacher, int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $batch = $this->makeBatch($this->makeCourse());
            $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

            \App\Models\ClassSession::create([
                'batch_id' => $batch->getKey(),
                'teacher_id' => $teacher->getKey(),
                'topic' => 'Upcoming class',
                'status' => 'scheduled',
                'starts_at' => now()->addDay(),
                'ends_at' => now()->addDay()->addHour(),
            ]);

            $student = $this->makeUser(RoleKey::Student);
            $this->enroll($student, $batch);
        }
    }
}
