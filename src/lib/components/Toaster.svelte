<!-- The toasts from toast.svelte.ts, bottom center. Hovering or focusing one keeps it open. -->
<script lang="ts">
  import { flip } from "svelte/animate";
  import { fade, fly } from "svelte/transition";
  import { ms } from "$lib/motion";
  import { dismissToast, runToastAction, toasts, type Toast } from "$lib/toast.svelte";
  import Icon, { type IconName } from "./Icon.svelte";

  const ICONS: Record<Toast["kind"], IconName> = { success: "check-circle", info: "info", error: "alert" };

  /** Closes the toast after its duration, pausing while the mouse or keyboard focus is on it. */
  function autoClose(node: HTMLElement, toast: Toast) {
    if (!toast.duration) return;
    let remaining = toast.duration;
    let startedAt = Date.now();
    let timer = setTimeout(close, remaining);
    let holds = 0;

    function close() {
      dismissToast(toast.id);
    }
    function hold() {
      if (holds++ > 0) return;
      clearTimeout(timer);
      remaining -= Date.now() - startedAt;
    }
    function release() {
      if (--holds > 0) return;
      startedAt = Date.now();
      timer = setTimeout(close, Math.max(remaining, 1500));
    }

    node.addEventListener("mouseenter", hold);
    node.addEventListener("mouseleave", release);
    node.addEventListener("focusin", hold);
    node.addEventListener("focusout", release);
    return {
      destroy() {
        clearTimeout(timer);
      },
    };
  }
</script>

<div
  class="pointer-events-none fixed bottom-7 left-1/2 z-[60] flex w-96 max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-stretch gap-2"
  role="region"
  aria-label="Notifications"
  aria-live="polite"
>
  {#each toasts as toast (toast.id)}
    <div
      class="pointer-events-auto flex items-start gap-3 rounded-item border border-line-strong bg-raised py-3 pr-2.5 pl-4 shadow-overlay"
      role={toast.kind === "error" ? "alert" : "status"}
      animate:flip={{ duration: ms() }}
      in:fly={{ y: 8, duration: ms() }}
      out:fade={{ duration: ms(120) }}
      use:autoClose={toast}
    >
      <span class="mt-px {toast.kind === 'error' ? 'text-danger' : 'text-accent-text'}">
        <Icon name={ICONS[toast.kind]} size={16} />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-ui text-strong">{toast.message}</p>
        {#if toast.detail}
          <p class="mt-0.5 line-clamp-4 text-xs break-words text-muted">{toast.detail}</p>
        {/if}
      </div>
      {#if toast.action}
        <button
          type="button"
          class="btn btn-sm -my-0.5 font-semibold text-accent-text hover:bg-hover"
          title={toast.undo ? "Undo (Ctrl+Z)" : undefined}
          onclick={() => runToastAction(toast)}
        >
          {toast.action.label}
        </button>
      {/if}
      <button type="button" class="icon-btn -my-0.5" aria-label="Close" onclick={() => dismissToast(toast.id)}>
        <Icon name="x" size={14} />
      </button>
    </div>
  {/each}
</div>
