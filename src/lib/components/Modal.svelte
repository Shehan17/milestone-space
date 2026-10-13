<!--
  A dialog with a form: Enter (or Ctrl+Enter anywhere) saves, Esc closes, Tab stays inside.
  Fields with an `error` (Field.svelte) block saving and show their message after the first try.
-->
<script lang="ts">
  import { setContext, type Snippet } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { ms } from "$lib/motion";
  import { modalOpened } from "$lib/shortcuts.svelte";
  import { FORM_CONTEXT, type FormState } from "./Field.svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    open: boolean;
    title: string;
    /** A line under the title. */
    description?: string;
    submitLabel?: string;
    danger?: boolean;
    /** "lg" for dialogs with a list or long text (task picker, templates). */
    size?: "md" | "lg";
    onclose: () => void;
    /** Omit for a read-only dialog: the footer then shows only a Close button. */
    onsubmit?: () => void | Promise<void>;
    /** Edit dialogs: a Delete button on the left of the footer. */
    ondelete?: () => void;
    deleteLabel?: string;
    /** No title bar (the title is still read out): for the New dialog, whose body is one big field. */
    hideHeader?: boolean;
    /** Left side of the footer, e.g. a hint about where the item goes. */
    footer?: Snippet;
    /** Right side of the title bar, e.g. the project a task belongs to. */
    aside?: Snippet;
    children: Snippet;
  }

  let {
    open,
    title,
    description,
    submitLabel = "Save",
    danger = false,
    size = "md",
    onclose,
    onsubmit,
    ondelete,
    deleteLabel = "Delete",
    hideHeader = false,
    footer,
    aside,
    children,
  }: Props = $props();

  const uid = $props.id();

  let dialog = $state<HTMLElement>();
  let form = $state<HTMLFormElement>();
  let closeButton = $state<HTMLButtonElement>();

  const formState = $state<FormState>({ attempted: false });
  setContext(FORM_CONTEXT, formState);

  // While open: page shortcuts are off, only the newest dialog reacts to Esc, and focus goes back
  // to where it was (e.g. a task row) on close.
  let stackEntry: ReturnType<typeof modalOpened> | null = null;

  $effect(() => {
    if (!open) return;
    formState.attempted = false;
    const previous = document.activeElement;
    const entry = modalOpened();
    stackEntry = entry;
    return () => {
      entry.close();
      if (stackEntry === entry) stackEntry = null;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  });

  // Focus the first field ([data-autofocus] wins). A dialog without fields (a confirmation)
  // focuses Cancel, so Enter never deletes by accident.
  $effect(() => {
    if (!open || !form) return;
    const target =
      form.querySelector<HTMLElement>("[data-autofocus]") ??
      form.querySelector<HTMLElement>("[data-modal-body] :is(input, textarea, select)") ??
      closeButton;
    target?.focus();
  });

  // Ignore extra submits (double-click, double Enter) while a save is running, so nothing is added twice.
  let submitting = $state(false);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!onsubmit) return onclose();
    if (submitting) return;
    // A field with an error: show the messages and go to the first one instead of saving.
    formState.attempted = true;
    const invalid = form?.querySelector<HTMLElement>("[data-invalid] :is(input, select, textarea)");
    if (invalid) {
      invalid.focus();
      return;
    }
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

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /** Tab and Shift+Tab go round the dialog instead of into the page behind it. */
  function trapFocus(event: KeyboardEvent) {
    if (!dialog) return;
    const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const [first, last] = [items[0], items[items.length - 1]];
    const inside = dialog.contains(document.activeElement);
    if (event.shiftKey && (!inside || document.activeElement === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (!open || !stackEntry?.isTop()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onclose();
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && onsubmit) {
      // Ctrl+Enter saves from anywhere in the form, including text areas where Enter adds a line.
      event.preventDefault();
      form?.requestSubmit();
    } else if (event.key === "Tab") {
      trapFocus(event);
    }
  }
</script>

<svelte:window {onkeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-(--scrim) p-4 pt-[10vh]"
    role="presentation"
    transition:fade={{ duration: ms() }}
    onmousedown={(e) => (pressedBackdrop = e.target === e.currentTarget)}
    onclick={onBackdropClick}
  >
    <div
      bind:this={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="{uid}-title"
      aria-describedby={description ? `${uid}-description` : undefined}
      class="flex max-h-[calc(90vh-1rem)] w-full flex-col {size === 'lg' ? 'max-w-xl' : 'max-w-md'} overflow-clip rounded-dialog border border-line-strong bg-raised shadow-overlay"
      transition:scale={{ start: 0.97, duration: ms() }}
    >
      <!-- Never taller than the window: the body scrolls, the title and the buttons stay. -->
      <form bind:this={form} class="flex min-h-0 flex-col" novalidate onsubmit={handleSubmit}>
        {#if hideHeader}
          <h2 id="{uid}-title" class="sr-only">{title}</h2>
        {:else}
          <div class="flex shrink-0 items-start gap-3 border-b border-line py-3.5 pr-3.5 pl-6">
            <div class="min-w-0 flex-1 py-0.5">
              <h2 id="{uid}-title" class="text-base font-semibold text-strong">{title}</h2>
              {#if description}
                <p id="{uid}-description" class="mt-0.5 text-ui text-muted">{description}</p>
              {/if}
            </div>
            {#if aside}<div class="flex min-w-0 shrink items-center self-center text-xs text-faint">{@render aside()}</div>{/if}
            <button type="button" class="icon-btn" aria-label="Close" title="Close (Esc)" onclick={onclose}>
              <Icon name="x" size={18} />
            </button>
          </div>
        {/if}

        <div class="min-h-0 space-y-4 overflow-y-auto {hideHeader ? 'px-4 pt-3.5 pb-1' : 'px-6 py-5'}" data-modal-body>
          {@render children()}
        </div>

        <div class="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-field py-3 {hideHeader ? 'px-4' : 'px-6'}">
          {#if ondelete}
            <button type="button" class="btn btn-danger-ghost -ml-2 mr-auto" onclick={ondelete}>
              <Icon name="trash" size={14} />{deleteLabel}
            </button>
          {:else if footer}
            <div class="mr-auto min-w-0 text-xs text-faint">{@render footer()}</div>
          {/if}
          {#if onsubmit}
            <button bind:this={closeButton} type="button" class="btn btn-ghost" onclick={onclose}>Cancel</button>
            <button type="submit" class="btn {danger ? 'btn-danger' : 'btn-primary'}" disabled={submitting}>
              {submitLabel}
            </button>
          {:else}
            <button bind:this={closeButton} type="button" class="btn btn-secondary" onclick={onclose}>Close</button>
          {/if}
        </div>
      </form>
    </div>
  </div>
{/if}
