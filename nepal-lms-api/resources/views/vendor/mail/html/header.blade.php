@props(['url', 'logo' => null, 'name' => null])
<tr>
<td class="header">
<a href="{{ $url }}" style="display: inline-block;">
@if ($logo)
<img src="{{ $logo }}" class="logo" alt="{{ $name }}">
@else
{!! $slot !!}
@endif
</a>
</td>
</tr>
