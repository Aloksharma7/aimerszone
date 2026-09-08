<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\LessonCompletion;
use App\Models\Recording;
use App\Models\Resource;
use App\Models\SyllabusLesson;
use App\Models\SyllabusModule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * A course's syllabus tab and its recordings/resources tabs used to be
 * unrelated — a syllabus lesson was just a typed title with no link to the
 * actual content a teacher uploaded, so the syllabus itself could never show
 * a real video, and watching every recording in a course still left
 * syllabus progress at 0% until the student also manually ticked every
 * matching checkbox by hand. syllabus_lesson_id closes both gaps: a
 * recording or resource can attach to the exact lesson it belongs to (not
 * just a module — a module can hold several lessons, each needing its own
 * video), and watching a linked recording to completion now marks that
 * lesson complete on its own.
 */
class SyllabusModuleContentLinkTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_teacher_can_list_the_syllabus_outline_for_their_batchs_course(): void
    {
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $module = SyllabusModule::create(['course_id' => $course->getKey(), 'title' => 'Elasticity', 'order' => 0]);
        $lesson = SyllabusLesson::create(['syllabus_module_id' => $module->getKey(), 'title' => 'Meaning and scope', 'type' => 'Recording', 'order' => 0]);

        $this->actingAs($teacher)
            ->getJson('/api/v1/teacher/batches/'.$batch->getKey().'/syllabus-modules')
            ->assertOk()
            ->assertJsonPath('data.0.id', $module->getKey())
            ->assertJsonPath('data.0.title', 'Elasticity')
            ->assertJsonPath('data.0.lessons.0.id', $lesson->getKey())
            ->assertJsonPath('data.0.lessons.0.title', 'Meaning and scope');
    }

    public function test_a_recording_can_be_attached_to_a_lesson_from_its_own_course(): void
    {
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);
        $module = SyllabusModule::create(['course_id' => $course->getKey(), 'title' => 'Elasticity', 'order' => 0]);
        $lesson = SyllabusLesson::create(['syllabus_module_id' => $module->getKey(), 'title' => 'Meaning and scope', 'type' => 'Recording', 'order' => 0]);

        $this->actingAs($teacher)
            ->postJson('/api/v1/teacher/batches/'.$batch->getKey().'/recordings', [
                'title' => 'Elasticity part 1',
                'youtube_video_id' => 'dQw4w9WgXcQ',
                'syllabus_lesson_id' => $lesson->getKey(),
            ])
            ->assertCreated();

        $this->assertDatabaseHas('recordings', ['title' => 'Elasticity part 1', 'syllabus_lesson_id' => $lesson->getKey()]);
    }

    public function test_a_recording_cannot_be_attached_to_a_lesson_from_a_different_course(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $otherModule = SyllabusModule::create(['course_id' => $this->makeCourse()->getKey(), 'title' => 'Unrelated', 'order' => 0]);
        $otherLesson = SyllabusLesson::create(['syllabus_module_id' => $otherModule->getKey(), 'title' => 'Unrelated lesson', 'type' => 'Recording', 'order' => 0]);
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);

        $this->actingAs($teacher)
            ->postJson('/api/v1/teacher/batches/'.$batch->getKey().'/recordings', [
                'title' => 'Elasticity part 1',
                'youtube_video_id' => 'dQw4w9WgXcQ',
                'syllabus_lesson_id' => $otherLesson->getKey(),
            ])
            ->assertStatus(422);
    }

    public function test_a_resource_can_be_attached_to_a_lesson_and_it_reaches_the_student_payload(): void
    {
        Storage::fake('local');
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $teacher = $this->makeUser(RoleKey::Teacher);
        $batch->teachers()->attach($teacher->getKey(), ['is_lead' => true]);
        $module = SyllabusModule::create(['course_id' => $course->getKey(), 'title' => 'Elasticity', 'order' => 0]);
        $lesson = SyllabusLesson::create(['syllabus_module_id' => $module->getKey(), 'title' => 'Notes', 'type' => 'Reading', 'order' => 0]);

        $this->actingAs($teacher)
            ->postJson('/api/v1/teacher/batches/'.$batch->getKey().'/resources', [
                'title' => 'Elasticity notes',
                'syllabus_lesson_id' => $lesson->getKey(),
                'release_now' => true,
                'file' => UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf'),
            ])
            ->assertCreated();

        $resource = Resource::where('title', 'Elasticity notes')->firstOrFail();
        $this->assertSame($lesson->getKey(), $resource->syllabus_lesson_id);

        $student = $this->makeUser(RoleKey::Student);
        $this->enroll($student, $batch);

        $this->actingAs($student)
            ->getJson('/api/v1/student/resources')
            ->assertOk()
            ->assertJsonPath('data.0.syllabus_lesson_id', $lesson->getKey());
    }

    public function test_watching_a_linked_recording_to_completion_marks_its_lesson_complete_without_a_manual_toggle(): void
    {
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $module = SyllabusModule::create(['course_id' => $course->getKey(), 'title' => 'Elasticity', 'order' => 0]);
        $lesson = SyllabusLesson::create(['syllabus_module_id' => $module->getKey(), 'title' => 'Meaning and scope', 'type' => 'Recording', 'order' => 0]);

        $recording = $this->makeRecording($batch, [
            'syllabus_lesson_id' => $lesson->getKey(),
            'released_at' => now()->subMinute(),
            'state' => 'available',
        ]);

        $student = $this->makeUser(RoleKey::Student);
        $enrollment = $this->enroll($student, $batch);

        $this->assertSame(0, $enrollment->fresh()->syllabus_percent);

        $this->actingAs($student)
            ->postJson('/api/v1/student/recordings/'.$recording->getKey().'/playback', ['progress_percent' => 100])
            ->assertOk();

        $this->assertDatabaseHas('lesson_completions', [
            'user_id' => $student->getKey(),
            'syllabus_lesson_id' => $lesson->getKey(),
        ]);
        $this->assertNotNull(LessonCompletion::where('syllabus_lesson_id', $lesson->getKey())->first()->completed_at);
        $this->assertSame(100, $enrollment->fresh()->syllabus_percent);

        $this->actingAs($student)
            ->getJson('/api/v1/student/courses/'.$enrollment->getKey().'/syllabus')
            ->assertOk()
            ->assertJsonPath('data.0.lessons.0.state', 'Completed')
            ->assertJsonPath('data.0.lessons.0.recording_id', $recording->getKey());
    }

    /**
     * Regression: the real player only ever called playback() once, on load,
     * to fetch the video id — nothing in the frontend ever reported ongoing
     * progress, so watch time and lesson auto-completion were dead in
     * production despite this backend logic being fully built and tested
     * (via the direct playback() call above). progress() is the periodic
     * check-in endpoint the player now actually calls; this proves it drives
     * the same high-water-mark and lesson-completion behavior as playback().
     */
    public function test_periodic_progress_checkins_reach_the_same_completion_as_a_direct_call(): void
    {
        $course = $this->makeCourse();
        $batch = $this->makeBatch($course);
        $module = SyllabusModule::create(['course_id' => $course->getKey(), 'title' => 'Elasticity', 'order' => 0]);
        $lesson = SyllabusLesson::create(['syllabus_module_id' => $module->getKey(), 'title' => 'Meaning and scope', 'type' => 'Recording', 'order' => 0]);

        $recording = $this->makeRecording($batch, [
            'syllabus_lesson_id' => $lesson->getKey(),
            'released_at' => now()->subMinute(),
            'state' => 'available',
        ]);

        $student = $this->makeUser(RoleKey::Student);
        $enrollment = $this->enroll($student, $batch);

        foreach ([10, 45, 30, 96] as $percent) {
            $this->actingAs($student)
                ->patchJson('/api/v1/student/recordings/'.$recording->getKey().'/progress', [
                    'progress_percent' => $percent,
                    'position_seconds' => $percent * 3,
                ])
                ->assertOk();
        }

        // The dip to 30 after 45 must never regress the stored high-water mark.
        $this->assertSame(96, \App\Models\RecordingProgress::where('recording_id', $recording->getKey())->where('user_id', $student->getKey())->value('progress_percent'));

        $this->assertDatabaseHas('lesson_completions', [
            'user_id' => $student->getKey(),
            'syllabus_lesson_id' => $lesson->getKey(),
        ]);
        $this->assertSame(100, $enrollment->fresh()->syllabus_percent);
    }
}
