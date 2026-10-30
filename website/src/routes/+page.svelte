<script lang="ts">
  import { appIcon } from "$lib/assets";
  import { features, pillars, tour } from "$lib/content";
  import { site } from "$lib/site";
  import Icon from "$lib/components/Icon.svelte";
  import Screenshot from "$lib/components/Screenshot.svelte";
  import Section from "$lib/components/Section.svelte";
</script>

<svelte:head>
  <title>{site.name}: projects, milestones and deadlines in one place</title>
  <meta name="description" content={site.description} />
  <meta property="og:title" content={site.name} />
  <meta property="og:description" content={site.description} />
</svelte:head>

<!-- Hero -->
<section class="hero relative overflow-hidden">
  <div class="container-page pt-20 pb-16 text-center sm:pt-28">
    <img src={appIcon} alt="" width="88" height="88" class="mx-auto mb-8" />
    <h1 class="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-strong sm:text-6xl">
      Your projects, milestones and deadlines in one calm place
    </h1>
    <p class="mx-auto mt-6 max-w-2xl text-lg text-muted sm:text-xl">
      A personal desktop workspace for freelancers who juggle client work, side projects and study.
      Offline and private: no account, no subscription.
    </p>
    <div class="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
      <a href={site.download} class="btn btn-primary btn-lg">
        <Icon name="download" size={20} />
        Download for Windows
      </a>
      <a href="#tour" class="btn btn-secondary btn-lg">Take the tour</a>
    </div>
  </div>
  <div class="container-page pb-8">
    <Screenshot
      name="today"
      alt="The Today page: today's plan, what needs attention, pinned projects and what's coming up"
      eager
    />
  </div>
</section>

<!-- Why -->
<Section eyebrow="Why MilestoneSpace" title="Made for one person with many projects">
  <div class="grid gap-5 md:grid-cols-3">
    {#each pillars as pillar (pillar.title)}
      <div class="card p-6">
        <div class="mb-4 inline-flex rounded-item bg-accent/15 p-2.5 text-accent-text">
          <Icon name={pillar.icon} size={22} />
        </div>
        <h3 class="text-lg font-semibold text-strong">{pillar.title}</h3>
        <p class="mt-2 text-muted">{pillar.text}</p>
      </div>
    {/each}
  </div>
</Section>

<!-- Features -->
<Section
  id="features"
  eyebrow="Features"
  title="Everything a busy week needs"
  intro="From the morning plan to the last deadline, without turning into a team tool."
>
  <div class="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
    {#each features as feature (feature.title)}
      <div class="flex gap-4">
        <div class="text-accent-text"><Icon name={feature.icon} size={22} /></div>
        <div>
          <h3 class="font-semibold text-strong">{feature.title}</h3>
          <p class="mt-1.5 text-muted">{feature.text}</p>
        </div>
      </div>
    {/each}
  </div>
</Section>

<!-- Tour -->
<Section id="tour" eyebrow="Tour" title="A look inside">
  <div class="flex flex-col gap-20 sm:gap-28">
    {#each tour as stop, i (stop.screenshot)}
      <div class="grid items-center gap-8 lg:grid-cols-5 lg:gap-12">
        <div class={["lg:col-span-2", i % 2 === 1 && "lg:order-last"]}>
          <h3 class="text-2xl font-semibold tracking-tight text-strong">{stop.title}</h3>
          <p class="mt-3 text-lg text-muted">{stop.text}</p>
        </div>
        <div class="lg:col-span-3">
          <Screenshot name={stop.screenshot} alt={stop.alt} width={stop.width} height={stop.height} />
        </div>
      </div>
    {/each}
  </div>
</Section>

<!-- Download -->
<section id="download" class="container-page pb-24">
  <div class="card hero relative overflow-hidden px-6 py-16 text-center">
    <h2 class="section-title">Get MilestoneSpace</h2>
    <p class="mx-auto mt-4 max-w-xl text-lg text-muted">
      For {site.platform}. Your data stays in one file on your computer, with automatic backups.
    </p>
    <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
      <a href={site.download} class="btn btn-primary btn-lg">
        <Icon name="download" size={20} />
        Download for Windows
      </a>
      <a href={site.repo} class="btn btn-secondary btn-lg">
        <Icon name="github" size={20} />
        View on GitHub
      </a>
    </div>
  </div>
</section>

<style>
  /* A soft accent glow behind the hero and the download card. */
  .hero {
    background-image: radial-gradient(
      ellipse 70% 50% at 50% 0%,
      color-mix(in srgb, var(--accent) 22%, transparent),
      transparent
    );
  }
</style>
