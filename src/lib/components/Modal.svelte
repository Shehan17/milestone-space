<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    open: boolean;
    title: string;
    submitLabel?: string;
    danger?: boolean;
    onclose: () => void;
    onsubmit: () => void | Promise<void>;
    children: Snippet;
  }

  let { open, title, submitLabel = "Save", danger = false, onclose, onsubmit, children }: Props =
    $props();

  let form = $state<HTMLFormElement>();

  // Focus the first field when the modal opens.
  $effect(() => {
    if (open && form) form.querySelector<HTMLElement>("input, textarea, select")?.focus();
  });

  // Ignore extra submits (double-click, double Enter) while a save is running, so nothing is added twice.
  let submitting = $state(false);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    try {
      await onsubmit();
    } finally {
      submitting = false;
    }
  }

  // Close on a backdrop click only if the press also started on the backdrop. Otherwise selecting
  // text in a field and releasing the mouse outside the dialog would close it.
  let pressedBackdrop = false;

  function onBackdropClick(event: MouseEvent) {
    if (pressedBackdrop && event.target === event.currentTarget) onclose();
    pressedBackdrop = false;
  }

  function onkeydown(event: KeyboardEvent) {
    if (open && event.key === "Escape") onclose();
  }
</script>

<svelte:window {onkeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
    role="presentation"
    onmousedown={(e) => (pressedBackdrop = e.target === e.currentTarget)}
    onclick={onBackdropClick}
  >
    <form
      bind:this={form}
      class="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/50"
      onsubmit={handleSubmit}
    >
      <div class="border-b border-zinc-800 px-5 py-3">
        <h2 class="text-sm font-semibold text-zinc-100">{title}</h2>
      </div>
      <div class="space-y-3 px-5 py-4">
        {@render children()}
      </div>
      <div class="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">
        <button type="button" class="btn btn-ghost" onclick={onclose}>Cancel</button>
        <button type="submit" class="btn {danger ? 'btn-danger' : 'btn-primary'}" disabled={submitting}>
          {submitLabel}
        </button>
      </div>
    </form>
  </div>
{/if}
