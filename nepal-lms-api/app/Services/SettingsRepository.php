<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;

/**
 * Every runtime-configurable value in the platform is read through here.
 *
 * Values live in the `settings` table so an administrator can change them from
 * /admin/settings without a deployment. config('lms.settings') supplies the
 * seed defaults and the fallback when a row is missing.
 */
class SettingsRepository
{
    protected const CACHE_KEY = 'lms.settings.all';

    protected const CACHE_TTL = 3600;

    /** @var array<string, mixed>|null */
    protected ?array $memo = null;

    /** @return array<string, mixed> Flat map of "group.key" => value */
    public function all(): array
    {
        return $this->memo ??= Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function (): array {
            $defaults = [];

            foreach ((array) config('lms.settings', []) as $group => $pairs) {
                foreach ((array) $pairs as $key => $value) {
                    $defaults["{$group}.{$key}"] = $value;
                }
            }

            $stored = [];

            foreach (Setting::all() as $setting) {
                $value = $setting->value;

                if ($setting->is_encrypted && is_string($value)) {
                    $value = rescue(fn () => Crypt::decryptString($value), null, false);
                }

                $stored["{$setting->group}.{$setting->key}"] = $value;
            }

            return array_merge($defaults, $stored);
        });
    }

    public function get(string $path, mixed $default = null): mixed
    {
        return Arr::get($this->all(), $path, $default ?? Arr::get(config('lms.settings'), $path));
    }

    public function string(string $path, string $default = ''): string
    {
        $value = $this->get($path, $default);

        return is_scalar($value) ? (string) $value : $default;
    }

    public function bool(string $path, bool $default = false): bool
    {
        return filter_var($this->get($path, $default), FILTER_VALIDATE_BOOL);
    }

    public function int(string $path, int $default = 0): int
    {
        $value = $this->get($path, $default);

        return is_numeric($value) ? (int) $value : $default;
    }

    /** @return array<string, mixed> Every key of one group, without the prefix. */
    public function group(string $group): array
    {
        $result = [];

        foreach ($this->all() as $path => $value) {
            if (str_starts_with($path, $group.'.')) {
                $result[substr($path, strlen($group) + 1)] = $value;
            }
        }

        return $result;
    }

    /**
     * Persist one value. Secrets are encrypted at rest and are never returned
     * by the administrator settings read endpoint.
     */
    public function set(string $group, string $key, mixed $value, bool $isPublic = false, bool $encrypt = false, ?string $updatedBy = null): void
    {
        Setting::updateOrCreate(
            ['group' => $group, 'key' => $key],
            [
                'value' => $encrypt && is_string($value) ? Crypt::encryptString($value) : $value,
                'type' => get_debug_type($value),
                'is_public' => $isPublic,
                'is_encrypted' => $encrypt,
                'updated_by' => $updatedBy,
            ],
        );

        $this->flush();
    }

    /**
     * Bulk update from the admin settings payload.
     *
     * @param  array<string, array<string, mixed>>  $groups
     * @return array<int, string> Paths that actually changed, for the audit entry.
     */
    public function setMany(array $groups, ?string $updatedBy = null): array
    {
        $changed = [];
        $before = $this->all();

        foreach ($groups as $group => $pairs) {
            foreach ((array) $pairs as $key => $value) {
                $path = "{$group}.{$key}";

                if (($before[$path] ?? null) === $value) {
                    continue;
                }

                $this->set($group, $key, $value, $this->isPublicPath($path), false, $updatedBy);
                $changed[] = $path;
            }
        }

        return $changed;
    }

    public function flush(): void
    {
        $this->memo = null;
        Cache::forget(self::CACHE_KEY);
    }

    /** Values safe to expose on the unauthenticated /public/settings endpoint. */
    protected function isPublicPath(string $path): bool
    {
        return str_starts_with($path, 'institution.');
    }
}
