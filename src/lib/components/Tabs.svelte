<script lang="ts" generics="T extends string">
  let {
    options,
    value = $bindable(),
    onchange,
  }: {
    options: { value: T; label: string; count?: number }[];
    value: T;
    onchange?: (value: T) => void;
  } = $props();

  function select(next: T) {
    value = next;
    onchange?.(next);
  }
</script>

<div class="inline-flex rounded-md border border-zinc-800 bg-zinc-900/60 p-0.5">
  {#each options as option (option.value)}
    <button
      type="button"
      class="rounded px-2.5 py-1 text-xs font-medium transition-colors {value === option.value
        ? 'bg-zinc-800 text-zinc-100'
        : 'text-zinc-500 hover:text-zinc-300'}"
      onclick={() => select(option.value)}
    >
      {option.label}
      {#if option.count !== undefined}
        <span class="ml-1 text-zinc-500 tabular-nums">{option.count}</span>
      {/if}
    </button>
  {/each}
</div>
