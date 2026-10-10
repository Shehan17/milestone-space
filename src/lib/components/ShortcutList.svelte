<!-- Every keyboard shortcut, by group. Used by the "?" dialog and the Settings page. -->
<script lang="ts">
  import { shortcutGroups } from "$lib/shortcuts.svelte";

  let { columns = false }: { columns?: boolean } = $props();
</script>

<div class={columns ? "grid gap-x-8 gap-y-4 md:grid-cols-2" : "space-y-4"}>
  {#each shortcutGroups() as group (group.title)}
    <section>
      <h3 class="mb-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{group.title}</h3>
      {#each group.items as item (item.label)}
        <div class="flex items-center justify-between gap-4 py-1">
          <span class="text-sm text-zinc-300">{item.label}</span>
          <span class="flex shrink-0 items-center gap-1.5">
            {#each item.keys as sequence, i (i)}
              {#if i > 0}<span class="text-xs text-zinc-600">/</span>{/if}
              <span class="flex items-center gap-0.5">
                {#each sequence as key, j (j)}
                  <kbd
                    class="min-w-5 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-center font-sans text-[11px] text-zinc-300"
                    >{key}</kbd
                  >
                {/each}
              </span>
            {/each}
          </span>
        </div>
      {/each}
    </section>
  {/each}
</div>
