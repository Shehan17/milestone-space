<script lang="ts">
  import { appIcon } from "$lib/assets";
  import { site } from "$lib/site";
</script>

<footer class="border-t border-line">
  <div class="container-page flex flex-col gap-4 py-10 text-sm text-faint sm:flex-row sm:items-center">
    <div class="flex items-center gap-2.5">
      <img src={appIcon} alt="" width="24" height="24" />
      <span class="text-muted">{site.name}</span>
    </div>
    <div class="flex gap-5 sm:ml-auto">
      <a class="hover:text-strong" href={site.repo}>Source code</a>
      <a class="hover:text-strong" href="{site.repo}/issues">Report a problem</a>
      <a class="hover:text-strong" href="{site.repo}/releases">Releases</a>
    </div>
  </div>
</footer>
