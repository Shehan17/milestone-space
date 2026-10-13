<!--
  A project's first letter on a tint of its color (project cards, pinned projects, project page).
  Mixed with the theme's own colors, so it reads on dark and light themes alike.
-->
<script lang="ts">
  let { name, color, size = 36 }: { name: string; color: string; size?: number } = $props();

  let initial = $derived(name.trim().charAt(0).toUpperCase() || "?");
</script>

<span
  class="grid shrink-0 place-items-center font-bold"
  style="width: {size}px; height: {size}px; border-radius: {Math.round(size * 0.2)}px; font-size: {Math.round(size * 0.42)}px;
    background-color: color-mix(in oklab, {color} 18%, var(--surface)); color: color-mix(in oklab, {color} 75%, var(--strong))"
  aria-hidden="true"
>
  {initial}
</span>
