<script lang="ts">
  import { helpState } from "$lib/shortcuts.svelte";
  import Modal from "./Modal.svelte";
  import ShortcutList from "./ShortcutList.svelte";
</script>

<Modal open={helpState.open} title="Keyboard shortcuts" size="lg" onclose={() => (helpState.open = false)}>
  <div class="-mx-5 -my-4 max-h-[60vh] overflow-y-auto px-5 py-4">
    <ShortcutList />
  </div>
</Modal>
