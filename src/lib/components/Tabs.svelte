<!--
  A row of options where one is chosen (views, settings), as a segmented control. ← and → move
  between them. variant="underline" draws page tabs instead (project page).
-->
<script lang="ts" generics="T extends string">
  import Icon, { type IconName } from "./Icon.svelte";

  let {
    options,
    value = $bindable(),
    onchange,
    label,
    variant = "segmented",
  }: {
    options: { value: T; label: string; count?: number | string; icon?: IconName }[];
    value: T;
    onchange?: (value: T) => void;
    /** Read out by screen readers, e.g. "Filter by status". */
    label?: string;
    variant?: "segmented" | "underline";
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

  const styles = {
    segmented: {
      group: "inline-flex max-w-full overflow-x-auto rounded-control border border-line bg-chrome p-0.75",
      button: "h-8 rounded-[0.3125rem] px-3.5 text-ui font-medium",
      on: "bg-selected text-strong",
      off: "text-muted hover:text-strong",
    },
    underline: {
      group: "flex max-w-full gap-1 overflow-x-auto border-b border-line",
      button: "-mb-px h-10.5 border-b-2 px-3.5 text-sm",
      on: "border-accent font-semibold text-strong",
      off: "border-transparent text-muted hover:text-strong",
    },
  };

  let style = $derived(styles[variant]);
</script>

<div class={style.group} role="group" aria-label={label}>
  {#each options as option, i (option.value)}
    {@const selected = value === option.value}
    <button
      bind:this={buttons[i]}
      type="button"
      class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap transition-colors duration-150 {style.button} {selected
        ? style.on
        : style.off}"
      aria-pressed={selected}
      tabindex={selected ? 0 : -1}
      onclick={() => select(option.value)}
      onkeydown={(e) => onkeydown(e, i)}
    >
      {#if option.icon}<Icon name={option.icon} size={14} />{/if}
      {option.label}
      {#if option.count !== undefined && option.count !== ""}
        <span class="text-xs font-normal text-faint tabular-nums">{option.count}</span>
      {/if}
    </button>
  {/each}
</div>
