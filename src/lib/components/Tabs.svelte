<!--
  A row of options where one is chosen (filters, views, settings). ← and → move between them.
-->
<script lang="ts" generics="T extends string">
  import Icon, { type IconName } from "./Icon.svelte";

  let {
    options,
    value = $bindable(),
    onchange,
    label,
  }: {
    options: { value: T; label: string; count?: number; icon?: IconName }[];
    value: T;
    onchange?: (value: T) => void;
    /** Read out by screen readers, e.g. "Filter by status". */
    label?: string;
  } = $props();

  let buttons = $state<HTMLButtonElement[]>([]);

  function select(next: T) {
    value = next;
    onchange?.(next);
  }

  function onkeydown(event: KeyboardEvent, index: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
    select(options[next].value);
    buttons[next]?.focus();
  }
</script>

<div class="inline-flex max-w-full overflow-x-auto rounded-control border border-line bg-canvas p-0.5" role="group" aria-label={label}>
  {#each options as option, i (option.value)}
    {@const selected = value === option.value}
    <button
      bind:this={buttons[i]}
      type="button"
      class="inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-150 {selected
        ? 'bg-selected text-strong'
        : 'text-muted hover:text-strong'}"
      aria-pressed={selected}
      tabindex={selected ? 0 : -1}
      onclick={() => select(option.value)}
      onkeydown={(e) => onkeydown(e, i)}
    >
      {#if option.icon}<Icon name={option.icon} size={12} />{/if}
      {option.label}
      {#if option.count !== undefined}
        <span class="tabular-nums {selected ? 'text-muted' : 'text-faint'}">{option.count}</span>
      {/if}
    </button>
  {/each}
</div>
