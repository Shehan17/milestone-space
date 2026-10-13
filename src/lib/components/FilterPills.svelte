<!-- Filter pills: one is chosen (project type, task status). ← and → move between them. -->
<script lang="ts" generics="T extends string">
  let {
    options,
    value = $bindable(),
    onchange,
    label,
  }: {
    options: { value: T; label: string; count?: number }[];
    value: T;
    onchange?: (value: T) => void;
    /** Read out by screen readers, e.g. "Filter by status". */
    label: string;
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

<div class="flex flex-wrap gap-1.5" role="group" aria-label={label}>
  {#each options as option, i (option.value)}
    {@const selected = value === option.value}
    <button
      bind:this={buttons[i]}
      type="button"
      class="pill {selected ? 'pill-on' : ''}"
      aria-pressed={selected}
      tabindex={selected ? 0 : -1}
      onclick={() => select(option.value)}
      onkeydown={(e) => onkeydown(e, i)}
    >
      {option.label}
      {#if option.count !== undefined}<span class="text-xs font-normal text-faint tabular-nums">{option.count}</span>{/if}
    </button>
  {/each}
</div>
