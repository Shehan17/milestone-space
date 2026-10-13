<script lang="ts">
  import { helpState } from "$lib/shortcuts.svelte";
  import Modal from "./Modal.svelte";
  import ShortcutList from "./ShortcutList.svelte";
</script>

<Modal open={helpState.open} title="Keyboard shortcuts" size="lg" onclose={() => (helpState.open = false)}>
  <div class="-mx-6 -my-5 max-h-[60vh] overflow-y-auto px-6 py-5">
    <ShortcutList />
  </div>
</Modal>
