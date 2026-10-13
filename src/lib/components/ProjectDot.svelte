<!-- A project's color marker next to its name: a small rounded square. -->
<script lang="ts">
  let { color, size = 8 }: { color: string; size?: number } = $props();
</script>

<span
  class="inline-block shrink-0"
  style="width: {size}px; height: {size}px; border-radius: {Math.round(size * 0.35)}px; background-color: {color}"
  aria-hidden="true"
></span>
