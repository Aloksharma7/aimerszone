<?php

namespace Tests\Unit;

use App\Support\PublicAssetUrl;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Deliberately does not fake the 'public' disk: Storage::fake() already
 * returns a relative URL by itself, which would make this pass whether or
 * not PublicAssetUrl actually strips anything — it would not have caught
 * the original bug. Storage::disk('public')->url() needs no file to exist
 * to build a URL, so the real (non-faked) disk config is safe to exercise
 * directly here.
 */
class PublicAssetUrlTest extends TestCase
{
    public function test_it_strips_the_scheme_and_host_off_the_disks_own_absolute_url(): void
    {
        $absolute = Storage::disk('public')->url('courses/thumbnails/example.jpg');
        $this->assertStringContainsString('://', $absolute, 'This assumption no longer holds — check the public disk config.');

        $relative = PublicAssetUrl::for('courses/thumbnails/example.jpg');

        $this->assertSame('/storage/courses/thumbnails/example.jpg', $relative);
        $this->assertStringNotContainsString('://', $relative);
    }

    public function test_a_pasted_external_url_passes_through_untouched(): void
    {
        $this->assertSame(
            'https://cdn.example.com/course.jpg',
            PublicAssetUrl::for('https://cdn.example.com/course.jpg'),
        );
    }

    public function test_a_null_path_returns_null(): void
    {
        $this->assertNull(PublicAssetUrl::for(null));
    }
}
