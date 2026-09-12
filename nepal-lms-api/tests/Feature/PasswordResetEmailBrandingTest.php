<?php

namespace Tests\Feature;

use App\Enums\RoleKey;
use App\Notifications\ResetPassword;
use App\Services\SettingsRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsLmsFixtures;
use Tests\TestCase;

/**
 * Regression: the password reset email's header was hard-coded to
 * config('app.name') as plain text and linked to config('app.url') — the
 * API's own address, not the public site — with no way to show the
 * institution's actual logo. Every other admin-branded surface (public site
 * header, footer) already reads this from Settings; the email was the one
 * place still stuck on framework defaults, which is why "Aimers Zone" never
 * appeared as more than plain text and the header link pointed at the API.
 *
 * MailMessage implements Renderable, so the template can be rendered
 * directly without sending anything — Mail::fake() cannot observe this
 * notification at all, since MailChannel builds it from a raw view/data
 * pair rather than a Mailable instance, which MailFake silently drops.
 */
class PasswordResetEmailBrandingTest extends TestCase
{
    use BuildsLmsFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlatform();
    }

    public function test_reset_email_shows_the_institution_logo_when_one_is_configured(): void
    {
        app(SettingsRepository::class)->set('institution', 'logo_path', 'branding/logo.png');
        $student = $this->makeUser(RoleKey::Student, ['email' => 'student@example.test']);

        $html = (string) (new ResetPassword('test-token'))->toMail($student)->render();

        $this->assertStringContainsString('<img src="'.config('app.frontend_url').'/storage/branding/logo.png"', $html);
        $this->assertStringContainsString(config('app.frontend_url'), $html);
    }

    public function test_reset_email_falls_back_to_the_institution_name_with_no_logo_configured(): void
    {
        $student = $this->makeUser(RoleKey::Student, ['email' => 'student2@example.test']);

        $html = (string) (new ResetPassword('test-token'))->toMail($student)->render();

        $this->assertStringNotContainsString('<img', $html);
        $this->assertStringContainsString(config('app.frontend_url'), $html);
    }
}
