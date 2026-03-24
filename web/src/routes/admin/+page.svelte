<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    getAdminStats,
    getAdminUsers,
    getAdminPosts,
    promoteUser,
    demoteUser,
    banUser,
    unbanUser,
    deletePost,
    restorePost,
    sendNewsletter,
    getNewsletterStatus,
    getNewsletterSends,
    upsertNewsletterDraft,
    toggleNewsletterPause,
    getAnalyticsOverview,
    getPostsPerDay,
    getRegistrationsPerDay,
    getEngagement,
    getRetention,
    getNewsletterAnalytics,
    getContentAnalytics,
    getActivationFunnel,
    getPageViewsAnalytics,
    getLinkClicksAnalytics,
    type AdminStats,
    type AdminUser,
    type AdminPost,
    type AnalyticsOverview,
    type DayCount,
    type NewsletterStatus,
    type NewsletterSendItem,
  } from '$lib/admin';
  import {
    getAdminFeeds, deleteAdminFeed, retryFeedLog, type AdminFeed,
    getScoringConfig as fetchScoringConfig, simulateScoring, applyScoring,
    type ScoringConfigData, type ScoringPost, type SimulatedPost,
  } from '$lib/admin';
  import { getFeedLogs, type FeedLog } from '$lib/feeds';

  let { data } = $props();
  const user = data.user!;

  let activeTab = $state<'analytics' | 'users' | 'posts' | 'newsletter' | 'feeds' | 'scoring'>('analytics');
  let stats = $state<AdminStats | null>(null);
  let users = $state<AdminUser[]>([]);
  let posts = $state<AdminPost[]>([]);
  let loading = $state(true);
  let error = $state('');

  // Newsletter state
  let showNewsletterModal = $state(false);
  let newsletterSending = $state(false);
  let newsletterResult = $state<{ sent: number; errors: number } | null>(null);
  let nlStatus = $state<NewsletterStatus | null>(null);
  let nlSends = $state<NewsletterSendItem[]>([]);
  let nlSubject = $state('');
  let nlSubjectSaving = $state(false);
  let nlSubjectSaved = $state(false);
  let nlCountdown = $state('');
  let nlLoading = $state(false);
  let nlTabLoaded = $state(false);
  let nlPauseToggling = $state(false);
  let countdownInterval: ReturnType<typeof setInterval> | undefined;

  // Feeds state
  let adminFeeds = $state<AdminFeed[]>([]);
  let feedsLoading = $state(false);
  let feedsTabLoaded = $state(false);
  let feedLogs = $state<FeedLog[]>([]);
  let feedLogsLoading = $state(false);
  let selectedAdminFeedId = $state<string | null>(null);
  let retryingLogId = $state<string | null>(null);

  // Scoring state
  let scoringLoading = $state(false);
  let scoringTabLoaded = $state(false);
  let scoringConfig = $state<ScoringConfigData | null>(null);
  let scoringPosts = $state<ScoringPost[]>([]);
  let simulatedPosts = $state<SimulatedPost[] | null>(null);
  let simulatedTotalPosts = $state(0);
  let simulating = $state(false);
  let applying = $state(false);
  let showApplyModal = $state(false);
  let applyResult = $state<{ updated: number } | null>(null);
  let editGravity = $state(1.5);
  let editBoost = $state(1.0);
  let editAgeOffset = $state(2.0);
  let editRecalcWindow = $state(720);

  // Analytics state
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  let startDate = $state(thirtyDaysAgo.toISOString().split('T')[0]);
  let endDate = $state(now.toISOString().split('T')[0]);
  let analyticsLoading = $state(false);
  let overview = $state<AnalyticsOverview | null>(null);
  let postsPerDay = $state<DayCount[]>([]);
  let registrationsPerDay = $state<DayCount[]>([]);
  let engagement = $state<any>(null);
  let retention = $state<any>(null);
  let newsletterStats = $state<any>(null);
  let content = $state<any>(null);
  let funnel = $state<any>(null);
  let pageViewsData = $state<any>(null);
  let linkClicksData = $state<any>(null);

  async function loadData() {
    loading = true;
    error = '';
    try {
      const [statsData, usersData, postsData] = await Promise.all([
        getAdminStats(),
        getAdminUsers(),
        getAdminPosts(),
      ]);
      stats = statsData;
      users = usersData.users;
      posts = postsData.posts;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al cargar datos';
      if (error.includes('403') || error.includes('401')) {
        goto('/');
      }
    } finally {
      loading = false;
    }
  }

  async function loadAnalytics() {
    analyticsLoading = true;
    try {
      const [ov, ppd, rpd, eng, ret, nl, cont, fun, pv, lc] = await Promise.all([
        getAnalyticsOverview(startDate, endDate),
        getPostsPerDay(startDate, endDate),
        getRegistrationsPerDay(startDate, endDate),
        getEngagement(startDate, endDate),
        getRetention(startDate, endDate),
        getNewsletterAnalytics(startDate, endDate),
        getContentAnalytics(startDate, endDate),
        getActivationFunnel(startDate, endDate),
        getPageViewsAnalytics(startDate, endDate),
        getLinkClicksAnalytics(startDate, endDate),
      ]);
      overview = ov;
      postsPerDay = ppd.data;
      registrationsPerDay = rpd.data;
      engagement = eng;
      retention = ret;
      newsletterStats = nl;
      content = cont;
      funnel = fun;
      pageViewsData = pv;
      linkClicksData = lc;
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      analyticsLoading = false;
    }
  }

  function maxCount(data: { count: number }[]): number {
    return Math.max(1, ...data.map((d) => d.count));
  }

  function formatSeconds(seconds: number | null): string {
    if (!seconds) return '-';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
    return `${Math.round(seconds / 86400)}d`;
  }

  async function handlePromote(id: string) { await promoteUser(id); users = users.map((u) => (u.id === id ? { ...u, isAdmin: true } : u)); }
  async function handleDemote(id: string) { await demoteUser(id); users = users.map((u) => (u.id === id ? { ...u, isAdmin: false } : u)); }
  async function handleBan(id: string) { await banUser(id); users = users.map((u) => (u.id === id ? { ...u, isBanned: true } : u)); }
  async function handleUnban(id: string) { await unbanUser(id); users = users.map((u) => (u.id === id ? { ...u, isBanned: false } : u)); }
  async function handleDelete(id: string) { await deletePost(id); posts = posts.map((p) => (p.id === id ? { ...p, isDeleted: true } : p)); }
  async function handleRestore(id: string) { await restorePost(id); posts = posts.map((p) => (p.id === id ? { ...p, isDeleted: false } : p)); }

  async function handleSendNewsletter() {
    newsletterSending = true;
    newsletterResult = null;
    try {
      const result = await sendNewsletter(nlStatus?.currentDraft?.id);
      newsletterResult = { sent: result.sent, errors: result.errors };
      // Reload newsletter data after send
      await loadNewsletterTab();
    } catch (err) {
      newsletterResult = { sent: 0, errors: -1 };
    } finally {
      newsletterSending = false;
    }
  }

  async function loadNewsletterTab() {
    nlLoading = true;
    try {
      const [status, sendsData] = await Promise.all([
        getNewsletterStatus(),
        getNewsletterSends(),
      ]);
      nlStatus = status;
      nlSends = sendsData.sends;
      nlSubject = status.currentDraft?.subject ?? '';
      startCountdown(status.secondsUntilNextSend);
    } catch (err) {
      console.error('Error loading newsletter tab:', err);
    } finally {
      nlLoading = false;
      nlTabLoaded = true;
    }
  }

  function startCountdown(seconds: number) {
    if (countdownInterval) clearInterval(countdownInterval);
    let remaining = seconds;
    updateCountdownDisplay(remaining);
    countdownInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        nlCountdown = 'Ahora';
      } else {
        updateCountdownDisplay(remaining);
      }
    }, 1000);
  }

  function updateCountdownDisplay(seconds: number) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    nlCountdown = parts.join(' ');
  }

  async function handleSaveSubject() {
    if (!nlSubject.trim()) return;
    nlSubjectSaving = true;
    nlSubjectSaved = false;
    try {
      await upsertNewsletterDraft(nlSubject);
      nlSubjectSaved = true;
      // Refresh status to get updated draft
      const status = await getNewsletterStatus();
      nlStatus = status;
      setTimeout(() => (nlSubjectSaved = false), 3000);
    } catch (err) {
      console.error('Error saving subject:', err);
    } finally {
      nlSubjectSaving = false;
    }
  }

  async function handleTogglePause() {
    if (!nlStatus) return;
    nlPauseToggling = true;
    try {
      const result = await toggleNewsletterPause(!nlStatus.paused);
      nlStatus = { ...nlStatus, paused: result.paused };
    } catch (err) {
      console.error('Error toggling newsletter pause:', err);
    } finally {
      nlPauseToggling = false;
    }
  }

  async function loadFeedsTab() {
    feedsLoading = true;
    try {
      const data = await getAdminFeeds();
      adminFeeds = data.feeds;
    } catch (err) {
      console.error('Error loading feeds:', err);
    } finally {
      feedsLoading = false;
      feedsTabLoaded = true;
    }
  }

  async function handleDeleteFeed(id: string) {
    try {
      await deleteAdminFeed(id);
      adminFeeds = adminFeeds.filter((f) => f.id !== id);
    } catch (err) {
      console.error('Error deleting feed:', err);
    }
  }

  async function loadFeedLogs(feedId: string) {
    if (selectedAdminFeedId === feedId) {
      selectedAdminFeedId = null;
      return;
    }
    selectedAdminFeedId = feedId;
    feedLogsLoading = true;
    try {
      const data = await getFeedLogs(feedId);
      feedLogs = data.logs;
    } catch (err) {
      console.error('Error loading feed logs:', err);
    } finally {
      feedLogsLoading = false;
    }
  }

  async function handleRetryLog(logId: string) {
    retryingLogId = logId;
    try {
      await retryFeedLog(logId);
      // Update status locally
      feedLogs = feedLogs.map((l) => l.id === logId ? { ...l, status: 'processing' as const, error: null } : l);
    } catch (err) {
      console.error('Error retrying log:', err);
    } finally {
      retryingLogId = null;
    }
  }

  async function loadScoringTab() {
    scoringLoading = true;
    try {
      const data = await fetchScoringConfig();
      scoringConfig = data.config;
      scoringPosts = data.posts;
      editGravity = data.config.gravity;
      editBoost = data.config.boost;
      editAgeOffset = data.config.ageOffsetHours;
      editRecalcWindow = data.config.recalcWindowHours;
    } catch (err) {
      console.error('Error loading scoring tab:', err);
    } finally {
      scoringLoading = false;
      scoringTabLoaded = true;
    }
  }

  async function handleSimulate() {
    simulating = true;
    simulatedPosts = null;
    try {
      const result = await simulateScoring({
        gravity: editGravity,
        boost: editBoost,
        ageOffsetHours: editAgeOffset,
        recalcWindowHours: editRecalcWindow,
      });
      simulatedPosts = result.posts;
      simulatedTotalPosts = result.totalPosts;
    } catch (err) {
      console.error('Error simulating:', err);
    } finally {
      simulating = false;
    }
  }

  async function handleApplyScoring() {
    applying = true;
    applyResult = null;
    try {
      const result = await applyScoring({
        gravity: editGravity,
        boost: editBoost,
        ageOffsetHours: editAgeOffset,
        recalcWindowHours: editRecalcWindow,
      });
      applyResult = { updated: result.updated };
      scoringConfig = {
        gravity: editGravity,
        boost: editBoost,
        ageOffsetHours: editAgeOffset,
        recalcWindowHours: editRecalcWindow,
      };
      // Reload scoring data
      await loadScoringTab();
      simulatedPosts = null;
    } catch (err) {
      console.error('Error applying scoring:', err);
    } finally {
      applying = false;
    }
  }

  function humanizeAge(dateStr: string): string {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const hours = diffMs / (1000 * 60 * 60);
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    const days = hours / 24;
    if (days < 7) return `${Math.round(days)}d`;
    if (days < 30) return `${Math.round(days / 7)}w`;
    return `${Math.round(days / 30)}mo`;
  }

  $effect(() => {
    if (activeTab === 'scoring' && !scoringTabLoaded) {
      loadScoringTab();
    }
  });

  $effect(() => {
    if (activeTab === 'newsletter' && !nlTabLoaded) {
      loadNewsletterTab();
    }
  });

  $effect(() => {
    if (activeTab === 'feeds' && !feedsTabLoaded) {
      loadFeedsTab();
    }
  });

  onMount(() => {
    loadData();
    loadAnalytics();
    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };
  });
</script>

<svelte:head>
  <title>Admin - the stack</title>
</svelte:head>

<div class="mt-4 sm:mt-8 w-full max-w-4xl mx-auto px-3 sm:px-4">
  <h1 class="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">Admin Panel</h1>

  <!-- Tabs -->
  <div class="flex gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-border overflow-x-auto">
    {#each ['analytics', 'users', 'posts', 'newsletter', 'feeds', 'scoring'] as tab}
      <button
        onclick={() => (activeTab = tab as typeof activeTab)}
        class="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap
          {activeTab === tab
          ? 'text-foreground border-b-2 border-accent'
          : 'text-muted-foreground hover:text-foreground'}"
      >
        {tab === 'analytics' ? 'Analytics' : tab === 'users' ? 'Usuarios' : tab === 'posts' ? 'Posts' : tab === 'newsletter' ? 'Newsletter' : tab === 'feeds' ? 'Feeds' : 'Scoring'}
      </button>
    {/each}
  </div>

  {#if loading}
    <p class="text-muted-foreground text-center py-8">Cargando...</p>
  {:else if error}
    <div class="rounded-lg border border-error bg-error/10 px-4 py-3 text-sm text-error">
      {error}
    </div>
  {:else}
    <!-- Analytics Tab -->
    {#if activeTab === 'analytics'}
      <!-- Date range picker -->
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <label class="text-sm text-muted-foreground">Desde</label>
        <input type="date" bind:value={startDate} class="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground" />
        <label class="text-sm text-muted-foreground">Hasta</label>
        <input type="date" bind:value={endDate} class="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground" />
        <button
          onclick={loadAnalytics}
          class="px-4 py-1.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Aplicar
        </button>
      </div>

      {#if analyticsLoading}
        <p class="text-muted-foreground text-center py-8">Cargando analytics...</p>
      {:else if overview}
        <!-- Summary cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div class="bg-card border border-border rounded-xl p-4 text-center">
            <p class="text-2xl font-bold text-foreground">{overview.pageViews.toLocaleString()}</p>
            <p class="text-xs text-muted-foreground">Page Views</p>
          </div>
          <div class="bg-card border border-border rounded-xl p-4 text-center">
            <p class="text-2xl font-bold text-foreground">{overview.uniqueVisitors.toLocaleString()}</p>
            <p class="text-xs text-muted-foreground">Visitantes</p>
          </div>
          <div class="bg-card border border-border rounded-xl p-4 text-center">
            <p class="text-2xl font-bold text-foreground">{overview.linkClicks.toLocaleString()}</p>
            <p class="text-xs text-muted-foreground">Link Clicks</p>
          </div>
          <div class="bg-card border border-border rounded-xl p-4 text-center">
            <p class="text-2xl font-bold text-foreground">{overview.newsletterOpens.toLocaleString()}</p>
            <p class="text-xs text-muted-foreground">Newsletter Opens</p>
          </div>
        </div>

        <!-- Engagement -->
        {#if engagement}
          <div class="bg-card border border-border rounded-xl p-4 mb-6">
            <h3 class="text-sm font-semibold text-foreground mb-3">Engagement (promedio/dia)</h3>
            <div class="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center">
              <div><p class="text-lg font-bold text-foreground">{engagement.postsPerDay}</p><p class="text-xs text-muted-foreground">Posts</p></div>
              <div><p class="text-lg font-bold text-foreground">{engagement.commentsPerDay}</p><p class="text-xs text-muted-foreground">Comentarios</p></div>
              <div><p class="text-lg font-bold text-foreground">{engagement.upvotesPerDay}</p><p class="text-xs text-muted-foreground">Upvotes</p></div>
              <div><p class="text-lg font-bold text-foreground">{engagement.commentsPerPost}</p><p class="text-xs text-muted-foreground">Comentarios/Post</p></div>
              <div><p class="text-lg font-bold text-foreground">{engagement.upvotesPerPost}</p><p class="text-xs text-muted-foreground">Upvotes/Post</p></div>
            </div>
          </div>
        {/if}

        <!-- Activation Funnel -->
        {#if funnel && funnel.totalUsers > 0}
          <div class="bg-card border border-border rounded-xl p-4 mb-6">
            <h3 class="text-sm font-semibold text-foreground mb-3">Funnel de activacion (usuarios registrados en el periodo)</h3>
            <div class="space-y-2">
              <div class="flex items-center gap-3">
                <span class="text-xs text-muted-foreground w-24 shrink-0">Registrados</span>
                <div class="flex-1 bg-muted rounded-full h-5">
                  <div class="bg-accent h-5 rounded-full" style="width: 100%"></div>
                </div>
                <span class="text-xs font-medium text-foreground w-20 text-right">{funnel.totalUsers} (100%)</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-xs text-muted-foreground w-24 shrink-0">Upvotearon</span>
                <div class="flex-1 bg-muted rounded-full h-5">
                  <div class="bg-accent h-5 rounded-full" style="width: {funnel.upvotedPct}%"></div>
                </div>
                <span class="text-xs font-medium text-foreground w-20 text-right">{funnel.upvoted} ({funnel.upvotedPct}%)</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-xs text-muted-foreground w-24 shrink-0">Comentaron</span>
                <div class="flex-1 bg-muted rounded-full h-5">
                  <div class="bg-accent h-5 rounded-full" style="width: {funnel.commentedPct}%"></div>
                </div>
                <span class="text-xs font-medium text-foreground w-20 text-right">{funnel.commented} ({funnel.commentedPct}%)</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-xs text-muted-foreground w-24 shrink-0">Postearon</span>
                <div class="flex-1 bg-muted rounded-full h-5">
                  <div class="bg-accent h-5 rounded-full" style="width: {funnel.postedPct}%"></div>
                </div>
                <span class="text-xs font-medium text-foreground w-20 text-right">{funnel.posted} ({funnel.postedPct}%)</span>
              </div>
            </div>
          </div>
        {/if}

        <!-- Page Views per Day -->
        {#if pageViewsData && pageViewsData.perDay.length > 0}
          <div class="bg-card border border-border rounded-xl p-4 mb-6">
            <h3 class="text-sm font-semibold text-foreground mb-3">Page Views por dia</h3>
            <div class="flex items-end gap-px h-24">
              {#each pageViewsData.perDay as d}
                <div
                  class="flex-1 bg-accent rounded-t-sm min-w-[3px]"
                  style="height: {(d.count / maxCount(pageViewsData.perDay)) * 100}%"
                  title="{d.day}: {d.count}"
                ></div>
              {/each}
            </div>
            <div class="flex justify-between mt-1">
              <span class="text-[10px] text-muted-foreground">{pageViewsData.perDay[0]?.day}</span>
              <span class="text-[10px] text-muted-foreground">{pageViewsData.perDay[pageViewsData.perDay.length - 1]?.day}</span>
            </div>
          </div>

          <!-- Top Paths -->
          {#if pageViewsData.topPaths.length > 0}
            <div class="bg-card border border-border rounded-xl p-4 mb-6">
              <h3 class="text-sm font-semibold text-foreground mb-3">Top Paginas</h3>
              <table class="w-full text-xs">
                <tbody>
                  {#each pageViewsData.topPaths as p}
                    <tr class="border-b border-border last:border-0">
                      <td class="py-1.5 text-foreground font-mono">{p.path}</td>
                      <td class="py-1.5 text-right text-muted-foreground">{p.count}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        {/if}

        <!-- Link Clicks per Day -->
        {#if linkClicksData && linkClicksData.perDay.length > 0}
          <div class="bg-card border border-border rounded-xl p-4 mb-6">
            <h3 class="text-sm font-semibold text-foreground mb-3">Link Clicks por dia</h3>
            <div class="flex items-end gap-px h-24">
              {#each linkClicksData.perDay as d}
                <div
                  class="flex-1 bg-accent rounded-t-sm min-w-[3px]"
                  style="height: {(d.count / maxCount(linkClicksData.perDay)) * 100}%"
                  title="{d.day}: {d.count}"
                ></div>
              {/each}
            </div>
          </div>

          {#if linkClicksData.topPosts.length > 0}
            <div class="bg-card border border-border rounded-xl p-4 mb-6">
              <h3 class="text-sm font-semibold text-foreground mb-3">Posts mas clickeados</h3>
              <table class="w-full text-xs">
                <tbody>
                  {#each linkClicksData.topPosts as p}
                    <tr class="border-b border-border last:border-0">
                      <td class="py-1.5 text-foreground truncate max-w-[300px]">{p.title || p.post_id}</td>
                      <td class="py-1.5 text-right text-muted-foreground">{p.click_count}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        {/if}

        <!-- Posts per Day -->
        {#if postsPerDay.length > 0}
          <div class="bg-card border border-border rounded-xl p-4 mb-6">
            <h3 class="text-sm font-semibold text-foreground mb-3">Posts por dia</h3>
            <div class="flex items-end gap-px h-24">
              {#each postsPerDay as d}
                <div
                  class="flex-1 bg-accent rounded-t-sm min-w-[3px]"
                  style="height: {(d.count / maxCount(postsPerDay)) * 100}%"
                  title="{d.day}: {d.count}"
                ></div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Registrations per Day -->
        {#if registrationsPerDay.length > 0}
          <div class="bg-card border border-border rounded-xl p-4 mb-6">
            <h3 class="text-sm font-semibold text-foreground mb-3">Registros por dia</h3>
            <div class="flex items-end gap-px h-24">
              {#each registrationsPerDay as d}
                <div
                  class="flex-1 bg-accent rounded-t-sm min-w-[3px]"
                  style="height: {(d.count / maxCount(registrationsPerDay)) * 100}%"
                  title="{d.day}: {d.count}"
                ></div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- DAU chart -->
        {#if retention && retention.dau.length > 0}
          <div class="bg-card border border-border rounded-xl p-4 mb-6">
            <h3 class="text-sm font-semibold text-foreground mb-3">DAU (usuarios activos por dia)</h3>
            <div class="flex items-end gap-px h-24">
              {#each retention.dau as d}
                {@const max = Math.max(1, ...retention.dau.map((x: any) => x.active_users))}
                <div
                  class="flex-1 bg-accent rounded-t-sm min-w-[3px]"
                  style="height: {(d.active_users / max) * 100}%"
                  title="{d.day}: {d.active_users}"
                ></div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Newsletter stats -->
        {#if newsletterStats}
          <div class="bg-card border border-border rounded-xl p-4 mb-6">
            <h3 class="text-sm font-semibold text-foreground mb-3">Newsletter</h3>
            <p class="text-sm text-muted-foreground mb-3">Subscribers activos: <span class="font-bold text-foreground">{newsletterStats.activeSubscribers}</span></p>
            {#if newsletterStats.sends.length > 0}
              <table class="w-full text-xs">
                <thead><tr>
                  <th class="text-left py-1 text-foreground">Fecha</th>
                  <th class="text-right py-1 text-foreground">Enviados</th>
                  <th class="text-right py-1 text-foreground">Abiertos</th>
                  <th class="text-right py-1 text-foreground">Open Rate</th>
                </tr></thead>
                <tbody>
                  {#each newsletterStats.sends as s}
                    <tr class="border-b border-border last:border-0">
                      <td class="py-1.5 text-foreground">{s.send_day}</td>
                      <td class="py-1.5 text-right text-muted-foreground">{s.total}</td>
                      <td class="py-1.5 text-right text-muted-foreground">{s.opened}</td>
                      <td class="py-1.5 text-right text-muted-foreground">{s.total > 0 ? Math.round(s.opened / s.total * 100) : 0}%</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {:else}
              <p class="text-xs text-muted-foreground">Sin envios en este periodo</p>
            {/if}
          </div>
        {/if}

        <!-- Top Content -->
        {#if content}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <!-- Top Posts -->
            <div class="bg-card border border-border rounded-xl p-4">
              <h3 class="text-sm font-semibold text-foreground mb-3">Top Posts</h3>
              <table class="w-full text-xs">
                <tbody>
                  {#each content.topPosts as p}
                    <tr class="border-b border-border last:border-0">
                      <td class="py-1.5 text-foreground truncate max-w-[200px]">{p.title}</td>
                      <td class="py-1.5 text-right text-muted-foreground">{p.upvotesCount}▲</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            <!-- Top Users -->
            <div class="bg-card border border-border rounded-xl p-4">
              <h3 class="text-sm font-semibold text-foreground mb-3">Top Usuarios</h3>
              <table class="w-full text-xs">
                <tbody>
                  {#each content.topUsers as u}
                    <tr class="border-b border-border last:border-0">
                      <td class="py-1.5 text-foreground">{u.username}</td>
                      <td class="py-1.5 text-right text-muted-foreground">{u.post_count} posts, {u.total_upvotes}▲</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Top Domains -->
          <div class="bg-card border border-border rounded-xl p-4 mb-6">
            <h3 class="text-sm font-semibold text-foreground mb-3">Top Dominios</h3>
            <table class="w-full text-xs">
              <tbody>
                {#each content.topDomains as d}
                  <tr class="border-b border-border last:border-0">
                    <td class="py-1.5 text-foreground">{d.domain}</td>
                    <td class="py-1.5 text-right text-muted-foreground">{d.post_count} posts, {d.total_upvotes}▲</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {/if}
    {/if}

    <!-- Users Tab -->
    {#if activeTab === 'users'}
      <div class="bg-card border border-border rounded-xl overflow-x-auto">
        <table class="w-full text-xs sm:text-sm min-w-[500px]">
          <thead class="bg-card border-b border-border">
            <tr>
              <th class="text-left px-4 py-3 font-medium text-foreground">Usuario</th>
              <th class="text-left px-4 py-3 font-medium text-foreground">Karma</th>
              <th class="text-left px-4 py-3 font-medium text-foreground">Estado</th>
              <th class="text-right px-4 py-3 font-medium text-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#each users as u (u.id)}
              <tr class="border-b border-border last:border-0">
                <td class="px-4 py-3">
                  <span class="font-medium text-foreground">{u.username}</span>
                  <span class="text-muted-foreground text-xs ml-2">{u.email}</span>
                </td>
                <td class="px-4 py-3 text-foreground">{u.karma}</td>
                <td class="px-4 py-3">
                  {#if u.isBanned}
                    <span class="text-error">Baneado</span>
                  {:else if u.isAdmin}
                    <span class="text-info">Admin</span>
                  {:else}
                    <span class="text-muted-foreground">Usuario</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-right space-x-2">
                  {#if u.id !== user?.id}
                    {#if u.isAdmin}
                      <button onclick={() => handleDemote(u.id)} class="text-xs text-warning hover:underline">
                        Quitar admin
                      </button>
                    {:else}
                      <button onclick={() => handlePromote(u.id)} class="text-xs text-info hover:underline">
                        Hacer admin
                      </button>
                    {/if}
                    {#if u.isBanned}
                      <button onclick={() => handleUnban(u.id)} class="text-xs text-success hover:underline">
                        Desbanear
                      </button>
                    {:else}
                      <button onclick={() => handleBan(u.id)} class="text-xs text-error hover:underline">
                        Banear
                      </button>
                    {/if}
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- Posts Tab -->
    {#if activeTab === 'posts'}
      <div class="bg-card border border-border rounded-xl overflow-x-auto">
        <table class="w-full text-xs sm:text-sm min-w-[500px]">
          <thead class="bg-card border-b border-border">
            <tr>
              <th class="text-left px-4 py-3 font-medium text-foreground">Titulo</th>
              <th class="text-left px-4 py-3 font-medium text-foreground">Autor</th>
              <th class="text-left px-4 py-3 font-medium text-foreground">Estado</th>
              <th class="text-right px-4 py-3 font-medium text-foreground">Accion</th>
            </tr>
          </thead>
          <tbody>
            {#each posts as p (p.id)}
              <tr class="border-b border-border last:border-0 {p.isDeleted ? 'opacity-50' : ''}">
                <td class="px-4 py-3">
                  <a href={p.url} target="_blank" class="text-foreground hover:underline">{p.title}</a>
                </td>
                <td class="px-4 py-3 text-foreground">{p.author.username}</td>
                <td class="px-4 py-3">
                  {#if p.isDeleted}
                    <span class="text-error">Eliminado</span>
                  {:else}
                    <span class="text-success">Activo</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-right">
                  {#if p.isDeleted}
                    <button onclick={() => handleRestore(p.id)} class="text-xs text-success hover:underline">
                      Restaurar
                    </button>
                  {:else}
                    <button onclick={() => handleDelete(p.id)} class="text-xs text-error hover:underline">
                      Eliminar
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- Newsletter Tab -->
    {#if activeTab === 'newsletter'}
      {#if nlLoading && !nlTabLoaded}
        <p class="text-muted-foreground text-center py-8">Cargando newsletter...</p>
      {:else}
        <!-- Estado del newsletter -->
        {#if nlStatus}
          <div class="bg-card border border-border rounded-xl p-6 mb-4 {nlStatus.paused ? 'border-warning/40' : ''}">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-foreground">Estado del newsletter</h3>
                <p class="text-sm text-muted-foreground mt-1">
                  {#if nlStatus.paused}
                    El envio automatico esta pausado. No se crearan borradores ni se enviaran newsletters.
                  {:else}
                    El newsletter se envia automaticamente cada lunes a las 18:00 UTC.
                  {/if}
                </p>
              </div>
              <button
                onclick={handleTogglePause}
                disabled={nlPauseToggling}
                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 {nlStatus.paused ? 'bg-accent text-accent-foreground hover:bg-accent/90' : 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20'}"
              >
                {#if nlPauseToggling}
                  ...
                {:else if nlStatus.paused}
                  Reanudar
                {:else}
                  Pausar
                {/if}
              </button>
            </div>
          </div>
        {/if}

        <!-- Proximo envio -->
        <div class="bg-card border border-border rounded-xl p-6 mb-4 {nlStatus?.paused ? 'opacity-50' : ''}">
          <h3 class="text-sm font-semibold text-foreground mb-3">Proximo envio</h3>
          <div class="flex flex-wrap items-baseline gap-4">
            {#if nlStatus?.paused}
              <span class="text-2xl font-bold text-muted-foreground">Pausado</span>
            {:else}
              <span class="text-2xl font-bold text-foreground font-mono">{nlCountdown}</span>
            {/if}
            {#if nlStatus}
              <span class="text-sm text-muted-foreground">
                {new Date(nlStatus.nextSendAt).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC
              </span>
              <span class="text-sm text-muted-foreground">
                &middot; {nlStatus.activeSubscribers} suscriptores
              </span>
            {/if}
          </div>
        </div>

        <!-- Asunto -->
        <div class="bg-card border border-border rounded-xl p-6 mb-4">
          <div class="flex items-center gap-3 mb-3">
            <h3 class="text-sm font-semibold text-foreground">Asunto</h3>
            {#if nlStatus?.currentDraft}
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-info/10 text-info border border-info/20">Borrador guardado</span>
            {:else}
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">Sin borrador</span>
            {/if}
            {#if nlSubjectSaved}
              <span class="text-[10px] text-success">Guardado</span>
            {/if}
          </div>
          <div class="flex gap-2">
            <input
              type="text"
              bind:value={nlSubject}
              placeholder="Asunto del newsletter..."
              class="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <button
              onclick={handleSaveSubject}
              disabled={nlSubjectSaving || !nlSubject.trim()}
              class="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {nlSubjectSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>

        <!-- Enviar ahora -->
        <div class="bg-card border border-border rounded-xl p-6 mb-4">
          <h3 class="text-sm font-semibold text-foreground mb-3">Enviar ahora</h3>
          <p class="text-sm text-muted-foreground mb-4">
            Envia el newsletter con los 5 posts mas votados de la semana a todos los suscriptores.
          </p>
          <button
            onclick={() => (showNewsletterModal = true)}
            class="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Enviar newsletter ahora
          </button>
        </div>

        <!-- Historial de envios -->
        {#if nlSends.length > 0}
          <div class="bg-card border border-border rounded-xl p-6">
            <h3 class="text-sm font-semibold text-foreground mb-3">Historial de envios</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-xs sm:text-sm">
                <thead>
                  <tr class="border-b border-border">
                    <th class="text-left py-2 text-foreground font-medium">Fecha</th>
                    <th class="text-left py-2 text-foreground font-medium">Asunto</th>
                    <th class="text-right py-2 text-foreground font-medium">Enviados</th>
                    <th class="text-right py-2 text-foreground font-medium">Abiertos</th>
                    <th class="text-right py-2 text-foreground font-medium">Open Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {#each nlSends as s}
                    <tr class="border-b border-border last:border-0">
                      <td class="py-2 text-foreground whitespace-nowrap">
                        {s.sentAt ? new Date(s.sentAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </td>
                      <td class="py-2 text-foreground truncate max-w-[250px]">{s.subject}</td>
                      <td class="py-2 text-right text-muted-foreground">{s.recipientCount ?? '-'}</td>
                      <td class="py-2 text-right text-muted-foreground">{s.openedCount}</td>
                      <td class="py-2 text-right text-muted-foreground">{s.openRate}%</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      {/if}
    {/if}

    <!-- Feeds Tab -->
    {#if activeTab === 'feeds'}
      {#if feedsLoading && !feedsTabLoaded}
        <p class="text-muted-foreground text-center py-8">Cargando feeds...</p>
      {:else if adminFeeds.length === 0}
        <p class="text-muted-foreground text-center py-8">No hay feeds creados.</p>
      {:else}
        <div class="bg-card border border-border rounded-xl overflow-x-auto">
          <table class="w-full text-xs sm:text-sm min-w-[500px]">
            <thead class="bg-card border-b border-border">
              <tr>
                <th class="text-left px-4 py-3 font-medium text-foreground">Usuario</th>
                <th class="text-left px-4 py-3 font-medium text-foreground">Nombre</th>
                <th class="text-left px-4 py-3 font-medium text-foreground">Email</th>
                <th class="text-left px-4 py-3 font-medium text-foreground">Ultimo</th>
                <th class="text-right px-4 py-3 font-medium text-foreground">Accion</th>
              </tr>
            </thead>
            <tbody>
              {#each adminFeeds as feed (feed.id)}
                <tr class="border-b border-border last:border-0">
                  <td class="px-4 py-3 text-foreground">{feed.owner.username}</td>
                  <td class="px-4 py-3 text-foreground">{feed.name}</td>
                  <td class="px-4 py-3">
                    <code class="text-xs text-muted-foreground">{feed.email}</code>
                  </td>
                  <td class="px-4 py-3 text-muted-foreground text-xs">
                    {feed.lastProcessedAt ? new Date(feed.lastProcessedAt).toLocaleDateString('es-CL') : '-'}
                  </td>
                  <td class="px-4 py-3 text-right space-x-2">
                    <button
                      onclick={() => loadFeedLogs(feed.id)}
                      class="text-xs text-accent hover:underline"
                    >
                      {selectedAdminFeedId === feed.id ? 'Ocultar' : 'Logs'}
                    </button>
                    <button
                      onclick={() => handleDeleteFeed(feed.id)}
                      class="text-xs text-error hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
                {#if selectedAdminFeedId === feed.id}
                  <tr>
                    <td colspan="5" class="px-4 py-3 bg-muted/30">
                      {#if feedLogsLoading}
                        <p class="text-xs text-muted-foreground">Cargando logs...</p>
                      {:else if feedLogs.length === 0}
                        <p class="text-xs text-muted-foreground">No hay logs.</p>
                      {:else}
                        <div class="space-y-2">
                          {#each feedLogs as log (log.id)}
                            <div class="border border-border rounded-lg p-3 text-xs bg-card">
                              <div class="flex items-center justify-between gap-2">
                                <span class="font-medium text-foreground truncate">{log.subject || 'Sin asunto'}</span>
                                <div class="flex items-center gap-2 shrink-0">
                                  <span class="px-2 py-0.5 rounded-full {log.status === 'completed' ? 'bg-success/10 text-success' : log.status === 'error' ? 'bg-error/10 text-error' : 'bg-muted text-muted-foreground'}">
                                    {log.status}
                                  </span>
                                  {#if log.status === 'error'}
                                    <button
                                      onclick={() => handleRetryLog(log.id)}
                                      disabled={retryingLogId === log.id}
                                      class="px-2 py-0.5 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                                    >
                                      {retryingLogId === log.id ? 'Reintentando...' : 'Reintentar'}
                                    </button>
                                  {/if}
                                </div>
                              </div>
                              {#if log.source}
                                <p class="mt-1 text-muted-foreground">Fuente: {log.source}</p>
                              {/if}
                              {#if log.error}
                                <p class="mt-1 text-error">{log.error}</p>
                              {/if}
                              <p class="mt-1 text-muted-foreground">{new Date(log.createdAt).toLocaleString('es-CL')}</p>
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}

    <!-- Scoring Tab -->
    {#if activeTab === 'scoring'}
      {#if scoringLoading && !scoringTabLoaded}
        <p class="text-muted-foreground text-center py-8">Cargando scoring...</p>
      {:else}
        <!-- Current config info -->
        {#if scoringConfig}
          <div class="bg-card border border-border rounded-xl p-6 mb-4">
            <h3 class="text-sm font-semibold text-foreground mb-1">Formula de ranking</h3>
            <p class="text-xs text-muted-foreground mb-4 font-mono">score = (upvotes - 1 + boost) / (ageHours + offset)^gravity</p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Gravity -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs text-muted-foreground">Gravity (decay)</label>
                  <span class="text-xs text-muted-foreground">0.5 - 3.0</span>
                </div>
                <div class="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    bind:value={editGravity}
                    class="flex-1 accent-accent"
                  />
                  <input
                    type="number"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    bind:value={editGravity}
                    class="w-20 bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground text-center"
                  />
                </div>
                <p class="text-[10px] text-muted-foreground mt-1">Mayor = posts decaen mas rapido. HN usa 1.8</p>
              </div>

              <!-- Boost -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs text-muted-foreground">Boost (visibilidad inicial)</label>
                  <span class="text-xs text-muted-foreground">0.0 - 5.0</span>
                </div>
                <div class="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="5.0"
                    step="0.1"
                    bind:value={editBoost}
                    class="flex-1 accent-accent"
                  />
                  <input
                    type="number"
                    min="0"
                    max="5.0"
                    step="0.1"
                    bind:value={editBoost}
                    class="w-20 bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground text-center"
                  />
                </div>
                <p class="text-[10px] text-muted-foreground mt-1">Se suma a upvotes. Da visibilidad inicial a posts nuevos</p>
              </div>

              <!-- Age Offset -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs text-muted-foreground">Offset de edad (horas)</label>
                  <span class="text-xs text-muted-foreground">0.5 - 10.0</span>
                </div>
                <div class="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.5"
                    max="10.0"
                    step="0.5"
                    bind:value={editAgeOffset}
                    class="flex-1 accent-accent"
                  />
                  <input
                    type="number"
                    min="0.5"
                    max="10.0"
                    step="0.5"
                    bind:value={editAgeOffset}
                    class="w-20 bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground text-center"
                  />
                </div>
                <p class="text-[10px] text-muted-foreground mt-1">Suaviza el ranking de posts muy nuevos</p>
              </div>

              <!-- Recalc Window -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs text-muted-foreground">Ventana de recalculo (horas)</label>
                  <span class="text-xs text-muted-foreground">24 - 720</span>
                </div>
                <div class="flex items-center gap-2">
                  <input
                    type="range"
                    min="24"
                    max="720"
                    step="24"
                    bind:value={editRecalcWindow}
                    class="flex-1 accent-accent"
                  />
                  <input
                    type="number"
                    min="24"
                    max="720"
                    step="24"
                    bind:value={editRecalcWindow}
                    class="w-20 bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground text-center"
                  />
                </div>
                <p class="text-[10px] text-muted-foreground mt-1">Posts mas viejos que esto no se recalculan en el cron. Actual: {scoringConfig.recalcWindowHours}h ({Math.round(scoringConfig.recalcWindowHours / 24)}d)</p>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center gap-3 mt-6">
              <button
                onclick={handleSimulate}
                disabled={simulating}
                class="px-4 py-2 bg-card border border-accent text-accent rounded-lg text-sm font-medium hover:bg-accent/10 transition-colors disabled:opacity-50"
              >
                {simulating ? 'Simulando...' : 'Simular'}
              </button>
              <button
                onclick={() => { showApplyModal = true; applyResult = null; }}
                disabled={applying}
                class="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {applying ? 'Aplicando...' : 'Aplicar configuracion'}
              </button>
              {#if scoringConfig && (editGravity !== scoringConfig.gravity || editBoost !== scoringConfig.boost || editAgeOffset !== scoringConfig.ageOffsetHours || editRecalcWindow !== scoringConfig.recalcWindowHours)}
                <span class="text-xs text-warning">Cambios sin aplicar</span>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Simulation results -->
        {#if simulatedPosts}
          {@const changed = simulatedPosts.filter(p => p.rankChange !== 0).length}
          <div class="bg-card border border-border rounded-xl p-6 mb-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-foreground">Simulacion (Top 50 de {simulatedTotalPosts} posts)</h3>
              <span class="text-xs text-muted-foreground">{changed} posts cambiaron de posicion</span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b border-border">
                    <th class="text-left py-2 text-foreground font-medium w-8">#</th>
                    <th class="text-center py-2 text-foreground font-medium w-12">Cambio</th>
                    <th class="text-left py-2 text-foreground font-medium">Titulo</th>
                    <th class="text-right py-2 text-foreground font-medium w-10">Votos</th>
                    <th class="text-right py-2 text-foreground font-medium w-14">Edad</th>
                    <th class="text-right py-2 text-foreground font-medium w-32">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {#each simulatedPosts as p, i (p.id)}
                    <tr class="border-b border-border last:border-0 {p.rankChange > 0 ? 'bg-success/5' : p.rankChange < 0 ? 'bg-error/5' : ''}">
                      <td class="py-1.5 text-foreground font-mono">{p.newRank}</td>
                      <td class="py-1.5 text-center">
                        {#if p.rankChange > 0}
                          <span class="text-success font-medium">+{p.rankChange}</span>
                        {:else if p.rankChange < 0}
                          <span class="text-error font-medium">{p.rankChange}</span>
                        {:else}
                          <span class="text-muted-foreground">=</span>
                        {/if}
                      </td>
                      <td class="py-1.5 text-foreground truncate max-w-[250px]" title={p.title}>{p.title}</td>
                      <td class="py-1.5 text-right text-muted-foreground">{p.upvotesCount}</td>
                      <td class="py-1.5 text-right text-muted-foreground">{humanizeAge(p.publishedAt ?? p.createdAt)}</td>
                      <td class="py-1.5 text-right font-mono">
                        <span class="text-muted-foreground">{p.currentScore.toFixed(4)}</span>
                        <span class="text-muted-foreground mx-1">→</span>
                        <span class="text-foreground">{p.newScore.toFixed(4)}</span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}

        <!-- Current ranking (when no simulation) -->
        {#if !simulatedPosts && scoringPosts.length > 0}
          <div class="bg-card border border-border rounded-xl p-6">
            <h3 class="text-sm font-semibold text-foreground mb-3">Ranking actual (Top 50)</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b border-border">
                    <th class="text-left py-2 text-foreground font-medium w-8">#</th>
                    <th class="text-left py-2 text-foreground font-medium">Titulo</th>
                    <th class="text-left py-2 text-foreground font-medium w-20">Autor</th>
                    <th class="text-right py-2 text-foreground font-medium w-10">Votos</th>
                    <th class="text-right py-2 text-foreground font-medium w-14">Edad</th>
                    <th class="text-right py-2 text-foreground font-medium w-20">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {#each scoringPosts as p, i (p.id)}
                    <tr class="border-b border-border last:border-0">
                      <td class="py-1.5 text-foreground font-mono">{i + 1}</td>
                      <td class="py-1.5 text-foreground truncate max-w-[250px]" title={p.title}>{p.title}</td>
                      <td class="py-1.5 text-muted-foreground">{p.authorUsername}</td>
                      <td class="py-1.5 text-right text-muted-foreground">{p.upvotesCount}</td>
                      <td class="py-1.5 text-right text-muted-foreground">{humanizeAge(p.publishedAt ?? p.createdAt)}</td>
                      <td class="py-1.5 text-right text-foreground font-mono">{p.currentScore.toFixed(4)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      {/if}
    {/if}
  {/if}
</div>

<!-- Scoring Apply Confirmation Modal -->
{#if showApplyModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-card border border-border rounded-xl p-6 max-w-md w-full">
      {#if applyResult}
        <div class="text-center">
          <div class="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <span class="text-success text-xl">OK</span>
          </div>
          <h3 class="text-lg font-semibold text-foreground mb-2">Configuracion aplicada</h3>
          <p class="text-sm text-muted-foreground mb-6">
            Se recalcularon los scores de {applyResult.updated} posts.
          </p>
          <button
            onclick={() => { showApplyModal = false; applyResult = null; }}
            class="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Cerrar
          </button>
        </div>
      {:else if applying}
        <div class="text-center">
          <div class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span class="text-muted-foreground">...</span>
          </div>
          <h3 class="text-lg font-semibold text-foreground mb-2">Aplicando...</h3>
          <p class="text-sm text-muted-foreground">Recalculando scores de todos los posts.</p>
        </div>
      {:else}
        <h3 class="text-lg font-semibold text-foreground mb-2">Confirmar cambios</h3>
        <p class="text-sm text-muted-foreground mb-4">
          Esto guardara la nueva configuracion y recalculara los scores de TODOS los posts publicados.
        </p>
        <div class="bg-muted/30 rounded-lg p-3 mb-4 text-xs font-mono space-y-1">
          <p>Gravity: {scoringConfig?.gravity} → <span class="text-foreground font-bold">{editGravity}</span></p>
          <p>Boost: {scoringConfig?.boost} → <span class="text-foreground font-bold">{editBoost}</span></p>
          <p>Offset: {scoringConfig?.ageOffsetHours}h → <span class="text-foreground font-bold">{editAgeOffset}h</span></p>
          <p>Ventana: {scoringConfig?.recalcWindowHours}h → <span class="text-foreground font-bold">{editRecalcWindow}h</span></p>
        </div>
        <div class="flex gap-3 justify-end">
          <button
            onclick={() => (showApplyModal = false)}
            class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onclick={handleApplyScoring}
            class="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Aplicar
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Newsletter Confirmation Modal -->
{#if showNewsletterModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-card border border-border rounded-xl p-6 max-w-md w-full">
      {#if newsletterResult}
        <div class="text-center">
          {#if newsletterResult.errors === -1}
            <div class="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
              <span class="text-error text-xl">!</span>
            </div>
            <h3 class="text-lg font-semibold text-foreground mb-2">Error</h3>
            <p class="text-sm text-muted-foreground mb-6">Ocurrio un error al enviar el newsletter.</p>
          {:else if newsletterResult.errors > 0}
            <div class="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
              <span class="text-warning text-xl">!</span>
            </div>
            <h3 class="text-lg font-semibold text-foreground mb-2">Envio parcial</h3>
            <p class="text-sm text-muted-foreground mb-6">
              Se enviaron {newsletterResult.sent} correos con {newsletterResult.errors} errores.
            </p>
          {:else}
            <div class="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <span class="text-success text-xl">✓</span>
            </div>
            <h3 class="text-lg font-semibold text-foreground mb-2">Enviado</h3>
            <p class="text-sm text-muted-foreground mb-6">
              Se enviaron {newsletterResult.sent} correos exitosamente.
            </p>
          {/if}
          <button
            onclick={() => { showNewsletterModal = false; newsletterResult = null; }}
            class="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Cerrar
          </button>
        </div>
      {:else if newsletterSending}
        <div class="text-center">
          <div class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span class="text-muted-foreground">...</span>
          </div>
          <h3 class="text-lg font-semibold text-foreground mb-2">Enviando...</h3>
          <p class="text-sm text-muted-foreground">Esto puede tomar unos segundos.</p>
        </div>
      {:else}
        <h3 class="text-lg font-semibold text-foreground mb-2">Confirmar envio</h3>
        <p class="text-sm text-muted-foreground mb-6">
          Estas seguro de que quieres enviar el newsletter ahora? Se enviara a todos los usuarios suscritos con email verificado.
        </p>
        <div class="flex gap-3 justify-end">
          <button
            onclick={() => (showNewsletterModal = false)}
            class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onclick={handleSendNewsletter}
            class="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Enviar
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
