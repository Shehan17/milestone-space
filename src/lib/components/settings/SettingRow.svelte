<!--
  A setting: label and description on the left, its control on the right. With `toggle`, the
  whole row is a label for the checkbox passed as the control, so clicking anywhere flips it.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label: string;
    description?: string;
    toggle?: boolean;
    disabled?: boolean;
    children?: Snippet;
    /** Extra content under the row (e.g. a list), full width. */
    below?: Snippet;
  }

  let { label, description, toggle = false, disabled = false, children, below }: Props = $props();
</script>

<svelte:element
  this={toggle ? "label" : "div"}
  class="block px-4 py-3 {disabled ? 'opacity-50' : ''} {toggle && !disabled ? 'cursor-pointer' : ''}"
>
  <div class="flex items-center justify-between gap-6">
    <div class="min-w-0">
      <p class="text-sm text-zinc-200">{label}</p>
      {#if description}<p class="text-xs text-zinc-500">{description}</p>{/if}
    </div>
    {#if children}<div class="flex shrink-0 items-center gap-2">{@render children()}</div>{/if}
  </div>
  {#if below}<div class="mt-3">{@render below()}</div>{/if}
</svelte:element>
