<?php

namespace App\Services;

use App\Models\User;

/**
 * Builds the overlay the player draws across recording playback.
 *
 * This is deterrence, not DRM. Unlisted YouTube and signed file URLs can both
 * be captured by anyone determined enough; what a moving watermark carrying the
 * viewer's own name and mobile changes is the incentive. A recording leaked
 * into a study group names the account it came from, which is enough to stop
 * casual sharing — the actual failure mode for a paid course in this market.
 *
 * The payload is generated per playback request, so it cannot be cached and
 * reused, and it moves on an interval so a single cropped screenshot does not
 * produce a clean copy.
 */
class WatermarkService
{
    public function __construct(
        protected SettingsRepository $settings,
        protected FeatureGate $features,
    ) {}

    /**
     * @return array{enabled: bool, text: string, opacity: int, interval_seconds: int, issued_at: string}|null
     */
    public function forViewer(User $user): ?array
    {
        if (! $this->features->watermark()) {
            return null;
        }

        return [
            'enabled' => true,
            'text' => $this->text($user),
            'opacity' => max(5, min(60, $this->settings->int('content.watermark_opacity', 18))),
            'interval_seconds' => max(4, $this->settings->int('content.watermark_interval_seconds', 12)),

            // Shown in the overlay so a screenshot also carries when it was
            // taken, not only by whom.
            'issued_at' => now()->format('Y-m-d H:i'),
        ];
    }

    /**
     * Identifies the account without exposing a full contact number to anyone
     * looking over the student's shoulder: last four digits are enough for the
     * institution to trace, and useless to a stranger.
     */
    protected function text(User $user): string
    {
        $parts = [$user->name];

        if (filled($user->mobile)) {
            $parts[] = '•••'.substr(preg_replace('/\D/', '', $user->mobile), -4);
        } elseif (filled($user->student_code)) {
            $parts[] = $user->student_code;
        }

        return implode('  ', $parts);
    }
}
