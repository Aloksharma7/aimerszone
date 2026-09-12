@php
    $institution = app(\App\Services\SettingsRepository::class)->group('institution');
    $institutionName = $institution['name'] ?? config('app.name');
    $institutionLogo = \App\Support\PublicAssetUrl::absolute($institution['logo_path'] ?? null);
@endphp
<x-mail::layout>
{{-- Header --}}
<x-slot:header>
<x-mail::header :url="config('app.frontend_url')" :logo="$institutionLogo" :name="$institutionName">
{{ $institutionName }}
</x-mail::header>
</x-slot:header>

{{-- Body --}}
{!! $slot !!}

{{-- Subcopy --}}
@isset($subcopy)
<x-slot:subcopy>
<x-mail::subcopy>
{!! $subcopy !!}
</x-mail::subcopy>
</x-slot:subcopy>
@endisset

{{-- Footer --}}
<x-slot:footer>
<x-mail::footer>
© {{ date('Y') }} {{ $institutionName }}. {{ __('All rights reserved.') }}
</x-mail::footer>
</x-slot:footer>
</x-mail::layout>
