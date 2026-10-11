<!--
  Shows the quick capture keys and records new ones: click "Change", then press the keys.
  Needs Ctrl, Alt or Win plus one other key. Rust registers them (set_quick_capture_keys) and
  keeps the old keys if the new ones are taken by another app.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { DEFAULT_QUICK_CAPTURE_KEYS, quickCaptureKeys, setQuickCaptureKeys, settings } from "$lib/settings.svelte";
  import { toast } from "$lib/toast.svelte";

  let recording = $state(false);
  let pressed = $state("");
  let error = $state("");
  let button = $state<HTMLButtonElement>();

  const MODIFIER_KEYS = ["Control", "Shift", "Alt", "Meta", "OS"];

  /** KeyboardEvent.code to the name Rust understands ("KeyK" → "K", "Digit1" → "1"). */
  function keyName(code: string): string | null {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^F([1-9]|1[0-2])$/.test(code)) return code;
    const named: Record<string, string> = {
      Space: "Space", Enter: "Enter", Tab: "Tab", Backspace: "Backspace", Delete: "Delete", Insert: "Insert",
      Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown",
      ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
      Minus: "Minus", Equal: "Equal", Comma: "Comma", Period: "Period", Slash: "Slash", Backslash: "Backslash",
      Semicolon: "Semicolon", Quote: "Quote", Backquote: "Backquote", BracketLeft: "BracketLeft", BracketRight: "BracketRight",
    };
    return named[code] ?? null;
  }

  async function start() {
    error = "";
    pressed = "";
    recording = true;
    await tick();
    button?.focus();
  }

  async function onkeydown(event: KeyboardEvent) {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      recording = false;
      return;
    }
    const mods = [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift", event.metaKey && "Super"].filter(
      (m): m is string => !!m
    );
    if (MODIFIER_KEYS.includes(event.key)) {
      pressed = mods.join("+");
      return;
    }
    const key = keyName(event.code);
    if (!key) {
      error = `${event.key} can't be used in a shortcut.`;
      return;
    }
    if (!event.ctrlKey && !event.altKey && !event.metaKey) {
      error = "Hold Ctrl, Alt or Win as well.";
      return;
    }
    recording = false;
    await save([...mods, key].join("+"));
  }

  async function save(keys: string | null) {
    try {
      await setQuickCaptureKeys(keys === DEFAULT_QUICK_CAPTURE_KEYS ? null : keys);
      error = "";
      toast.success(`Quick capture is now ${quickCaptureKeys().split("+").map(label).join("+")}`);
    } catch (e) {
      error = String(e);
    }
  }

  // The "Super" modifier is the Windows key.
  const label = (key: string) => (key === "Super" ? "Win" : key);
</script>

<div class="flex flex-col items-end gap-1">
  <div class="flex items-center gap-2">
    {#if recording}
      <button
        bind:this={button}
        type="button"
        class="rounded-control border border-accent bg-field px-2.5 py-1 text-xs text-fg ring-2 ring-accent/25 outline-none"
        {onkeydown}
        onblur={() => (recording = false)}
      >
        {pressed ? `${pressed.split("+").map(label).join("+")}+…` : "Press the new keys… (Esc to cancel)"}
      </button>
    {:else}
      <span class="flex gap-0.5">
        {#each quickCaptureKeys().split("+") as key (key)}
          <kbd class="kbd">{label(key)}</kbd>
        {/each}
      </span>
      <button type="button" class="btn btn-secondary btn-sm" onclick={start}>Change</button>
      {#if settings.quick_capture_keys !== null}
        <button type="button" class="btn btn-ghost btn-sm" onclick={() => save(null)}>Reset</button>
      {/if}
    {/if}
  </div>
  {#if error}<p class="max-w-xs text-right text-xs text-danger" role="alert">{error}</p>{/if}
</div>
