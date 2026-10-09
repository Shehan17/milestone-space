<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { THEMES, getTheme, setTheme, type Theme, type ThemeId } from "$lib/theme";

  let current = $state<ThemeId>(getTheme());

  function choose(id: ThemeId) {
    current = id;
    setTheme(id);
  }

  const groups = [
    { label: "Dark", themes: THEMES.filter((t) => t.mode === "dark") },
    { label: "Light", themes: THEMES.filter((t) => t.mode === "light") },
  ];
</script>

<!-- A miniature of the app drawn in the theme's own colors, so it previews correctly from any theme. -->
{#snippet preview(theme: Theme)}
  {@const c = theme.preview}
  <div class="flex h-24 overflow-hidden rounded-md border" style="background: {c.bg}; border-color: {c.border}">
    <div class="w-1/4 space-y-1.5 border-r p-2" style="border-color: {c.border}">
      <div class="h-1.5 w-3/4 rounded-full" style="background: {c.accent}"></div>
      <div class="h-1.5 w-full rounded-full" style="background: {c.muted}; opacity: 0.5"></div>
      <div class="h-1.5 w-2/3 rounded-full" style="background: {c.muted}; opacity: 0.5"></div>
    </div>
    <div class="flex-1 space-y-2 p-2.5">
      <div class="h-2 w-1/2 rounded-full" style="background: {c.text}"></div>
      <div class="space-y-1.5 rounded border p-2" style="background: {c.card}; border-color: {c.border}">
        <div class="h-1.5 w-5/6 rounded-full" style="background: {c.muted}"></div>
        <div class="h-1 overflow-hidden rounded-full" style="background: {c.border}">
          <div class="h-full w-3/5" style="background: {c.accent}"></div>
        </div>
      </div>
    </div>
  </div>
{/snippet}

<PageHeader title="Settings" />

<div class="max-w-3xl space-y-6 px-8 py-6">
  <section class="card">
    <div class="border-b border-zinc-800 px-4 py-2.5">
      <h2 class="text-xs font-semibold text-zinc-300">Appearance</h2>
      <p class="text-xs text-zinc-500">Color theme for the whole app. Saved on this computer.</p>
    </div>
    <div class="space-y-5 p-4">
      {#each groups as group (group.label)}
        <div>
          <p class="mb-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{group.label}</p>
          <div class="grid gap-3 sm:grid-cols-2">
            {#each group.themes as theme (theme.id)}
              {@const selected = current === theme.id}
              <button
                type="button"
                class="cursor-pointer rounded-lg border p-2.5 text-left transition-colors {selected
                  ? 'border-violet-500 ring-1 ring-violet-500/40'
                  : 'border-zinc-800 hover:border-zinc-700'}"
                aria-pressed={selected}
                onclick={() => choose(theme.id)}
              >
                {@render preview(theme)}
                <div class="mt-2.5 flex items-center gap-2">
                  <span class="text-sm font-medium text-zinc-100">{theme.name}</span>
                  {#if selected}
                    <span class="ml-auto text-violet-400"><Icon name="check" size={14} /></span>
                  {/if}
                </div>
                <p class="text-xs text-zinc-500">{theme.description}</p>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>
