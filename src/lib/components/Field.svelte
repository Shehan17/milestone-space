<script module lang="ts">
  /**
   * Shared by Modal.svelte and its fields. Errors only show after the first Save, so a new,
   * empty form doesn't start out red; from then on they update as you type.
   */
  export const FORM_CONTEXT = Symbol("form");

  export interface FormState {
    attempted: boolean;
  }
</script>

<script lang="ts">
  import { getContext, type Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    label: string;
    /** What's wrong with the value, or null. Modal doesn't save while a field has an error. */
    error?: string | null;
    /** A short help line under the field (replaced by the error when there is one). */
    hint?: string;
    /** For a control that isn't one input (DateInput): the label points at this id instead of wrapping it. */
    for?: string;
    children: Snippet;
  }

  let { label, error = null, hint, for: forId, children }: Props = $props();

  const form = getContext<FormState | undefined>(FORM_CONTEXT);
  let showError = $derived(!!error && (form?.attempted ?? true));
</script>

{#snippet message()}
  {#if showError}
    <span class="field-error"><Icon name="alert" size={12} />{error}</span>
  {:else if hint}
    <span class="mt-1 block text-xs text-faint">{hint}</span>
  {/if}
{/snippet}

{#if forId}
  <div data-invalid={error ? "" : undefined} data-show-error={showError ? "" : undefined}>
    <label for={forId} class="mb-1 block text-xs font-medium text-muted">{label}</label>
    {@render children()}
    {@render message()}
  </div>
{:else}
  <label class="block" data-invalid={error ? "" : undefined} data-show-error={showError ? "" : undefined}>
    <span class="mb-1 block text-xs font-medium text-muted">{label}</span>
    {@render children()}
    {@render message()}
  </label>
{/if}
