<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Streams a CSV straight to the client.
 *
 * Exports are built row by row through a chunked cursor rather than collected
 * into an array first, so a large report does not depend on how much memory the
 * PHP process happens to have.
 */
class CsvStream
{
    /**
     * @param  array<int, string>  $headers  Column headings, in order.
     * @param  callable  $mapper  Receives a model, returns a flat row array.
     */
    public static function fromQuery(Builder $query, array $headers, callable $mapper, string $filename): StreamedResponse
    {
        return response()->stream(function () use ($query, $headers, $mapper) {
            $handle = fopen('php://output', 'wb');

            // BOM so Excel opens Nepali and other UTF-8 text correctly.
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, $headers);

            $query->chunkById(500, function ($records) use ($handle, $mapper) {
                foreach ($records as $record) {
                    fputcsv($handle, array_map(self::sanitize(...), $mapper($record)));
                }

                flush();
            });

            fclose($handle);
        }, 200, self::responseHeaders($filename));
    }

    /**
     * @param  array<int, string>  $headers
     * @param  iterable<int, array<int, mixed>>  $rows
     */
    public static function fromRows(iterable $rows, array $headers, string $filename): StreamedResponse
    {
        return response()->stream(function () use ($rows, $headers) {
            $handle = fopen('php://output', 'wb');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, $headers);

            foreach ($rows as $row) {
                fputcsv($handle, array_map(self::sanitize(...), array_values((array) $row)));
            }

            fclose($handle);
        }, 200, self::responseHeaders($filename));
    }

    protected static function responseHeaders(string $filename): array
    {
        $safe = preg_replace('/[^A-Za-z0-9._-]/', '-', $filename);

        return [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$safe.'"',
            'Cache-Control' => 'no-store, private',
            'X-Content-Type-Options' => 'nosniff',
        ];
    }

    /**
     * Neutralises CSV injection: a cell beginning with =, +, - or @ is executed
     * as a formula when the file is opened in a spreadsheet, and student-supplied
     * names and notes end up in these exports.
     */
    protected static function sanitize(mixed $value): string
    {
        $value = match (true) {
            $value === null => '',
            is_bool($value) => $value ? 'Yes' : 'No',
            $value instanceof \DateTimeInterface => $value->format('Y-m-d H:i'),
            default => (string) $value,
        };

        return str_starts_with($value, '=')
            || str_starts_with($value, '+')
            || str_starts_with($value, '-')
            || str_starts_with($value, '@')
                ? "'".$value
                : $value;
    }
}
