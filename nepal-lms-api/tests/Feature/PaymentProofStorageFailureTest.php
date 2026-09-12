<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Models\Payment;
use App\Models\PaymentMethod;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\UnableToCreateDirectory;
use Mockery;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: a real production incident — the "local" disk's target
 * directory could not be created (a server permissions problem), which
 * Flysystem raises as an exception rather than a `false` return value.
 * storeProof() only checked for `false`, so this crashed as a bare,
 * unexplained 500 instead of the clear, retryable message a student (or
 * whoever read the log afterward) actually needed.
 */
class PaymentProofStorageFailureTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_a_storage_failure_while_saving_the_proof_gives_a_clear_message_instead_of_a_crash(): void
    {
        $batch = $this->makeBatch($this->makeCourse());
        $student = $this->makeUser(RoleKey::Student);

        $disk = Mockery::mock(Filesystem::class);
        $disk->shouldReceive('putFileAs')->andThrow(UnableToCreateDirectory::atLocation('payment-proof/whatever', 'Permission denied'));
        Storage::shouldReceive('disk')->with('local')->andReturn($disk);

        $this->actingAs($student)
            ->postJson('/api/v1/student/payments', [
                'batch_id' => $batch->getKey(),
                'payment_method_id' => PaymentMethod::first()->getKey(),
                'amount_npr' => 5000,
                'payer_name' => 'Test Student',
                'paid_at' => now()->toDateString(),
                'proof_file' => UploadedFile::fake()->image('proof.jpg'),
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'storage_unavailable');

        $this->assertSame(0, Payment::where('user_id', $student->getKey())->count());
    }
}
