<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/**
 * Safety net for storage/app/zoom-recordings/.
 *
 * The happy path in ProcessZoomRecording already deletes each temp file the
 * moment its upload succeeds, so this should normally find nothing to do —
 * it exists for the failure case: a job that crashed, got killed, or ran out
 * of retries mid-way can leave a large video file behind with nothing left
 * to ever clean it up. Deletes anything older than 30 days outright, and
 * beyond that, if the directory is still over the configured size cap,
 * deletes the oldest files until it's back under it — recordings are never
 * lost, since a successful upload means the file already exists on YouTube.
 */
class CleanupStaleRecordingDownloads extends Command
{
    protected $signature = 'lms:cleanup-recording-downloads {--max-age-days=30} {--max-total-gb=10}';

    protected $description = 'Delete stale or excess temporary Zoom recording downloads.';

    public function handle(): int
    {
        $directory = storage_path('app/zoom-recordings');

        if (! is_dir($directory)) {
            $this->info('Nothing to clean up — the directory does not exist yet.');

            return self::SUCCESS;
        }

        $maxAgeSeconds = (int) $this->option('max-age-days') * 86400;
        $maxTotalBytes = (int) ((float) $this->option('max-total-gb') * 1024 * 1024 * 1024);

        $files = collect(scandir($directory) ?: [])
            ->reject(fn (string $name) => in_array($name, ['.', '..'], true))
            ->map(fn (string $name) => $directory.DIRECTORY_SEPARATOR.$name)
            ->filter('is_file')
            ->map(fn (string $path) => ['path' => $path, 'mtime' => filemtime($path) ?: 0, 'size' => filesize($path) ?: 0])
            ->sortBy('mtime')
            ->values();

        $deletedForAge = 0;
        $deletedForSize = 0;

        $remaining = $files->reject(function (array $file) use ($maxAgeSeconds, &$deletedForAge) {
            if (now()->timestamp - $file['mtime'] > $maxAgeSeconds) {
                @unlink($file['path']);
                $deletedForAge++;

                return true;
            }

            return false;
        })->values();

        $totalBytes = $remaining->sum('size');

        foreach ($remaining as $file) {
            if ($totalBytes <= $maxTotalBytes) {
                break;
            }

            @unlink($file['path']);
            $totalBytes -= $file['size'];
            $deletedForSize++;
        }

        $this->info("Deleted {$deletedForAge} file(s) older than {$this->option('max-age-days')} days, {$deletedForSize} more to stay under {$this->option('max-total-gb')} GB.");

        return self::SUCCESS;
    }
}
