const header = document.querySelector("[data-header]");
const root = document.documentElement;
const menu = document.querySelector("[data-menu]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const issueLinks = Array.from(document.querySelectorAll('[data-section-link][href^="#"]'));
const currentDate = document.querySelector("[data-current-date]");
const newsStrip = document.querySelector("[data-news-strip]");
const newsLabel = document.querySelector("[data-news-label]");
const tickerTrack = document.querySelector(".ticker-track");
let tickerPrev = null;
let tickerNext = null;
let activeTickerIndex = null;
let focusedTickerIndex = null;
let tickerItemCount = 0;
const issueStrip = document.querySelector(".issue-strip");
const archiveSearch = document.querySelector("[data-archive-search]");
const archiveFilters = Array.from(document.querySelectorAll("[data-archive-filter]"));
const archiveItems = Array.from(document.querySelectorAll("[data-archive-item]"));
const archiveEmpty = document.querySelector("[data-archive-empty]");
let issueSections = [];
let activeIssueIndex = 0;

const systemPrefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
const systemPrefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const systemTheme = systemPrefersLight ? "light" : "dark";
const themeFromUrl = new URLSearchParams(window.location.search).get("theme");
const initialTheme = themeFromUrl === "light" || themeFromUrl === "dark" ? themeFromUrl : systemTheme;
root.dataset.theme = initialTheme;

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

const resetInitialScroll = () => {
  if (window.location.hash) return;
  window.scrollTo(0, 0);
};

const getCleanDisplayUrl = (href) => {
  const url = new URL(href, window.location.href);
  if (url.protocol === "file:") return url.href;

  url.pathname = url.pathname
    .replace(/\/index\.html$/i, "/")
    .replace(/\/(notes|about|legal|terms|privacy)\.html$/i, "/$1")
    .replace(/\/articles\/([^/]+)\.html$/i, "/articles/$1");

  return url.href;
};

const cleanInitialUrl = () => {
  if (!window.history.replaceState) return;
  const url = new URL(window.location.href);
  if (themeFromUrl) url.searchParams.delete("theme");
  const cleanUrl = getCleanDisplayUrl(url.href);
  if (cleanUrl !== window.location.href) {
    window.history.replaceState({}, "", cleanUrl);
  }
};

const updateThemeButton = () => {
  if (!themeToggle) return;
  const isLight = root.dataset.theme === "light";
  themeToggle.setAttribute("aria-label", isLight ? "Toggle dark mode" : "Toggle light mode");
};

cleanInitialUrl();
updateThemeButton();
resetInitialScroll();
window.addEventListener("load", () => {
  window.requestAnimationFrame(resetInitialScroll);
}, { once: true });

const wireArticleBackLinks = () => {
  if (!window.location.pathname.includes("/articles/")) return;
  document.querySelectorAll(".page-back a").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      window.history.back();
    });
  });
};

wireArticleBackLinks();

const alignImageBufferedCards = () => {
  const cards = Array.from(document.querySelectorAll([
    ".home-page .top-story-card",
    ".notes-lead",
    ".archive-page .edition-row",
  ].join(", ")));
  if (!cards.length) return;

  cards.forEach((card) => card.style.removeProperty("--story-image-adjust"));

  window.requestAnimationFrame(() => {
    const rows = [];
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const row = rows.find((candidate) => Math.abs(candidate.top - rect.top) < 12);
      if (row) {
        row.cards.push(card);
        row.top = Math.min(row.top, rect.top);
      } else {
        rows.push({ top: rect.top, cards: [card] });
      }
    });

    rows.forEach(({ cards: rowCards }) => {
      const rowMetrics = rowCards.map((card) => {
        const text = card.querySelector("p");
        const cta = card.querySelector(".card-cta");
        if (!text || !cta) return null;

        return {
          card,
          freeSpace: cta.getBoundingClientRect().top - text.getBoundingClientRect().bottom,
        };
      }).filter(Boolean);

      if (!rowMetrics.length) return;
      const naturalSpace = Math.min(...rowMetrics.map((metric) => metric.freeSpace));
      const targetSpace = Math.min(naturalSpace, 18);

      rowMetrics.forEach(({ card, freeSpace }) => {
        const adjustment = Math.min(180, Math.max(0, Math.round(freeSpace - targetSpace)));
        if (adjustment > 0) {
          card.style.setProperty("--story-image-adjust", `${adjustment}px`);
        }
      });
    });
  });
};

const scheduleHomeCardAlignment = () => {
  window.requestAnimationFrame(alignImageBufferedCards);
  window.setTimeout(alignImageBufferedCards, 120);
};

scheduleHomeCardAlignment();
window.addEventListener("load", scheduleHomeCardAlignment, { once: true });
window.addEventListener("resize", scheduleHomeCardAlignment);
if (document.fonts?.ready) {
  document.fonts.ready.then(scheduleHomeCardAlignment).catch(() => {});
}

// Remove broken optional assets instead of showing empty image frames.
document.querySelectorAll("[data-fallback-remove]").forEach((image) => {
  image.addEventListener("error", () => image.remove(), { once: true });
});

const updateIssueStripWrap = () => {
  if (!issueStrip) return;
  const visibleItems = Array.from(issueStrip.children).filter((item) => {
    return window.getComputedStyle(item).display !== "none";
  });
  const firstTop = visibleItems[0]?.offsetTop ?? 0;
  const isWrapped = visibleItems.some((item) => Math.abs(item.offsetTop - firstTop) > 2);
  issueStrip.classList.toggle("is-wrapped", isWrapped);
};

// Keep sticky offsets in CSS so anchor scrolling lands below the header stack.
const getHeaderOffset = () => {
  updateIssueStripWrap();
  const height = header?.offsetHeight || 72;
  const newsbarHeight = newsStrip?.offsetHeight || 0;
  const issueStripHeight = issueStrip?.scrollHeight || 0;
  root.style.setProperty("--header-height", `${height}px`);
  root.style.setProperty("--newsbar-height", `${newsbarHeight}px`);
  root.style.setProperty("--issue-strip-height", `${issueStripHeight}px`);
  return height + newsbarHeight + issueStripHeight + 18;
};

if ("ResizeObserver" in window) {
  const stickyMetricObserver = new ResizeObserver(() => {
    window.requestAnimationFrame(() => {
      updateIssueStripWrap();
      getHeaderOffset();
    });
  });
  [header, newsStrip, issueStrip].filter(Boolean).forEach((element) => {
    stickyMetricObserver.observe(element);
  });
}

window.addEventListener("load", updateIssueStripWrap, { once: true });

const getDocumentTop = (element) => {
  return element.getBoundingClientRect().top + window.scrollY;
};

const updateScrollProgress = () => {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
  root.style.setProperty("--scroll-progress", `${progress * 100}%`);
};

const scrollToY = (top) => {
  window.scrollTo({
    top: Math.max(0, top),
    behavior: systemPrefersReducedMotion.matches ? "auto" : "smooth",
  });
};

// Carry the active theme across internal pages without cookies or local storage.
const getThemeAwareUrl = (href) => {
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname && url.hash) return null;

  if (root.dataset.theme === systemTheme) {
    url.searchParams.delete("theme");
  } else {
    url.searchParams.set("theme", root.dataset.theme);
  }
  return url.href;
};

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link || event.defaultPrevented) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (link.target && link.target !== "_self") return;
  if (link.hasAttribute("download")) return;

  const nextUrl = getThemeAwareUrl(link.getAttribute("href"));
  if (!nextUrl) return;

  event.preventDefault();
  window.location.assign(nextUrl);
});

// Render the current issue date in the small metadata strip.
const formatIssueDate = () => {
  if (!currentDate) return;
  currentDate.textContent = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
};

// Downgrade stale breaking-style labels automatically.
const updateNewsLabel = () => {
  if (!newsStrip || !newsLabel) return;
  const lastUpdated = new Date(newsStrip.dataset.lastUpdated);
  if (Number.isNaN(lastUpdated.getTime())) return;

  const ageInHours = (Date.now() - lastUpdated.getTime()) / 36e5;
  if (newsStrip.dataset.breaking === "true" && ageInHours <= 36) {
    newsLabel.textContent = "Update";
    newsStrip.dataset.status = "breaking";
  } else if (ageInHours <= 168) {
    newsLabel.textContent = "Notes";
    newsStrip.dataset.status = "latest";
  } else {
    newsLabel.textContent = "Archive";
    newsStrip.dataset.status = "archive";
  }
};

formatIssueDate();
updateNewsLabel();

// Load the lightweight content index and use it as the notes ticker source.
const getContentFeedUrl = () => {
  const scriptUrl = document.currentScript?.src || new URL("script.js", window.location.href).href;
  return new URL("content/articles.json", scriptUrl);
};

const getSiteRelativeUrl = (href) => {
  return new URL(href, new URL("../", getContentFeedUrl())).href;
};

const getTickerTitle = (item) => {
  const title = item.tickerTitle || item.title || "";
  return title.length > 62 ? `${title.slice(0, 59).trim()}...` : title;
};

const renderTickerFromArticles = (items = []) => {
  if (!newsStrip || !tickerTrack || !items.length) return;

  const now = Date.now();
  const maxAgeInDays = 21;
  const activeItems = items
    .filter((item) => item.status === "published")
    .filter((item) => item.tickerTitle !== false)
    .map((item) => ({
      ...item,
      timestamp: new Date(item.updated || item.date).getTime(),
    }))
    .filter((item) => !Number.isNaN(item.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp);

  const currentItems = activeItems.filter((item) => (now - item.timestamp) / 864e5 <= maxAgeInDays);
  const tickerItems = (currentItems.length >= 3 ? currentItems : activeItems).slice(0, 6);
  if (!tickerItems.length) return;

  const newest = tickerItems[0];
  newsStrip.dataset.lastUpdated = new Date(newest.timestamp).toISOString();
  updateNewsLabel();

  tickerItemCount = tickerItems.length;
  activeTickerIndex = null;
  focusedTickerIndex = null;
  const repeatedItems = tickerItems.length > 1 ? [...tickerItems, ...tickerItems] : tickerItems;
  tickerTrack.replaceChildren(...repeatedItems.map((item, index) => {
    const element = item.url ? document.createElement("a") : document.createElement("span");
    const label = document.createElement("span");
    label.className = "ticker-text";
    label.textContent = getTickerTitle(item);
    element.dataset.tickerIndex = String(index % tickerItems.length);
    element.append(label);
    if (item.url) element.href = getSiteRelativeUrl(item.url);
    return element;
  }));
  tickerTrack.scrollLeft = 0;
  updateTickerSelection();
  setupTickerMotion();
};

const loadArticleFeed = async () => {
  if (!newsStrip || !tickerTrack) return;

  try {
    const response = await fetch(getContentFeedUrl(), { cache: "no-cache" });
    if (!response.ok) return;
    const feed = await response.json();
    renderTickerFromArticles(feed.items);
  } catch {
    updateNewsLabel();
  }
};

loadArticleFeed();

const setupTickerControls = () => {
  if (!newsStrip || !tickerTrack || newsStrip.querySelector(".ticker-control")) return;

  const controls = document.createElement("div");
  controls.className = "ticker-controls";
  controls.setAttribute("aria-label", "Ticker controls");

  tickerPrev = document.createElement("button");
  tickerPrev.className = "ticker-control ticker-control-prev";
  tickerPrev.type = "button";
  tickerPrev.setAttribute("aria-label", "Previous note");
  tickerPrev.textContent = "\u2039";

  tickerNext = document.createElement("button");
  tickerNext.className = "ticker-control ticker-control-next";
  tickerNext.type = "button";
  tickerNext.setAttribute("aria-label", "Next note");
  tickerNext.textContent = "\u203a";

  controls.append(tickerPrev, tickerNext);
  newsStrip.append(controls);
};

const ensureTickerItemIndexes = () => {
  if (!tickerTrack) return;
  const items = Array.from(tickerTrack.querySelectorAll("a, span"));
  if (!items.length || items.some((item) => item.dataset.tickerIndex)) return;

  const tickerItems = items.filter((item) => item.parentElement === tickerTrack);
  tickerItemCount = tickerItems.length;
  tickerItems.forEach((item, index) => {
    const text = item.textContent;
    item.textContent = "";
    const label = document.createElement("span");
    label.className = "ticker-text";
    label.textContent = text;
    item.append(label);
    item.dataset.tickerIndex = String(index);
  });
  updateTickerSelection();
};

const updateTickerSelection = () => {
  if (!tickerTrack) return;
  const items = Array.from(tickerTrack.querySelectorAll("[data-ticker-index]"));
  if (!items.length) return;

  items.forEach((item) => {
    const isActive = activeTickerIndex !== null && Number(item.dataset.tickerIndex) === activeTickerIndex;
    item.classList.toggle("is-active", isActive);
    item.classList.remove("is-before-active");
    if (isActive) {
      item.setAttribute("aria-current", "true");
    } else {
      item.removeAttribute("aria-current");
    }
  });

  if (activeTickerIndex !== null) {
    items.forEach((item, index) => {
      if (Number(item.dataset.tickerIndex) !== activeTickerIndex) return;
      const previous = items[index - 1];
      if (previous) previous.classList.add("is-before-active");
    });
  }
};

const setupTickerMotion = () => {
  if (!tickerTrack) return;
  setupTickerControls();
  ensureTickerItemIndexes();
  if (tickerTrack.dataset.motionReady === "true") return;
  tickerTrack.dataset.motionReady = "true";
  tickerTrack.classList.add("is-carousel");

  let carouselResumeTimer = 0;
  let carouselPanTimers = [];
  let tickerAutoFrame = 0;
  let tickerAutoTime = 0;
  let tickerPointerInside = false;
  let tickerPointerDown = false;
  const clearCarouselTimers = () => {
    carouselPanTimers.forEach((timer) => window.clearTimeout(timer));
    carouselPanTimers = [];
  };
  const getCarouselTickerItems = () => Array.from(tickerTrack.querySelectorAll("[data-ticker-index]"));
  const getLoopDistance = () => {
    return tickerItemCount > 1 ? tickerTrack.scrollWidth / 2 : Math.max(0, tickerTrack.scrollWidth - tickerTrack.clientWidth);
  };
  const normalizeTickerScroll = () => {
    const loopDistance = getLoopDistance();
    if (loopDistance <= 1) return;
    while (tickerTrack.scrollLeft >= loopDistance) {
      tickerTrack.scrollLeft -= loopDistance;
    }
    while (tickerTrack.scrollLeft < 0) {
      tickerTrack.scrollLeft += loopDistance;
    }
  };
  const getCenterTickerItem = () => {
    const trackRect = tickerTrack.getBoundingClientRect();
    const trackCenter = trackRect.left + trackRect.width / 2;
    return getCarouselTickerItems().reduce((best, item) => {
      const rect = item.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.right, trackRect.right) - Math.max(rect.left, trackRect.left));
      if (!visible) return best;
      const distance = Math.abs(rect.left + rect.width / 2 - trackCenter);
      return distance < best.distance ? { item, distance } : best;
    }, { item: null, distance: Number.POSITIVE_INFINITY }).item || getCarouselTickerItems()[0] || null;
  };
  const scrollTickerItemToStart = (item, behavior = "smooth") => {
    if (!item) return;
    const text = item.querySelector(".ticker-text") || item;
    const trackRect = tickerTrack.getBoundingClientRect();
    const textRect = text.getBoundingClientRect();
    const maxScroll = Math.max(0, tickerTrack.scrollWidth - tickerTrack.clientWidth);
    const target = Math.min(maxScroll, Math.max(0, tickerTrack.scrollLeft + textRect.left - trackRect.left));
    tickerTrack.scrollTo({ left: target, behavior });
  };
  const getTickerItemByIndex = (index, direction = 1) => {
    const normalizedIndex = (index + tickerItemCount) % tickerItemCount;
    let items = getCarouselTickerItems().filter((item) => Number(item.dataset.tickerIndex) === normalizedIndex);
    if (!items.length) return null;

    const trackRect = tickerTrack.getBoundingClientRect();
    const readableLeft = trackRect.left;
    let moves = items
      .map((item) => {
        const text = item.querySelector(".ticker-text") || item;
        const target = tickerTrack.scrollLeft + text.getBoundingClientRect().left - readableLeft;
        return { item, target };
      })
      .filter((entry) => direction > 0 ? entry.target > tickerTrack.scrollLeft + 2 : entry.target < tickerTrack.scrollLeft - 2)
      .sort((a, b) => direction > 0 ? a.target - b.target : b.target - a.target);

    if (!moves.length && direction < 0) {
      const loopDistance = getLoopDistance();
      if (loopDistance > 1) {
        tickerTrack.scrollLeft += loopDistance;
        items = getCarouselTickerItems().filter((item) => Number(item.dataset.tickerIndex) === normalizedIndex);
        moves = items
          .map((item) => {
            const text = item.querySelector(".ticker-text") || item;
            const target = tickerTrack.scrollLeft + text.getBoundingClientRect().left - readableLeft;
            return { item, target };
          })
          .filter((entry) => entry.target < tickerTrack.scrollLeft - 2)
          .sort((a, b) => b.target - a.target);
      }
    }

    if (!moves.length && direction > 0) {
      normalizeTickerScroll();
      items = getCarouselTickerItems().filter((item) => Number(item.dataset.tickerIndex) === normalizedIndex);
      moves = items
        .map((item) => {
          const text = item.querySelector(".ticker-text") || item;
          const target = tickerTrack.scrollLeft + text.getBoundingClientRect().left - readableLeft;
          return { item, target };
        })
        .filter((entry) => entry.target > tickerTrack.scrollLeft + 2)
        .sort((a, b) => a.target - b.target);
    }

    return moves[0]?.item || items[0];
  };
  const gentlyPanLongTickerItem = (item) => {
    const text = item?.querySelector(".ticker-text") || item;
    if (!text || text.getBoundingClientRect().width <= tickerTrack.clientWidth - 24) return;
    const trackRect = tickerTrack.getBoundingClientRect();
    const textRect = text.getBoundingClientRect();
    const maxScroll = Math.max(0, tickerTrack.scrollWidth - tickerTrack.clientWidth);
    const rightTarget = Math.min(maxScroll, Math.max(0, tickerTrack.scrollLeft + textRect.right - trackRect.right + 12));
    carouselPanTimers.push(window.setTimeout(() => {
      tickerTrack.scrollTo({ left: rightTarget, behavior: "smooth" });
    }, 1000));
    carouselPanTimers.push(window.setTimeout(() => {
      scrollTickerItemToStart(item);
    }, 4600));
  };
  const clearTickerFocus = () => {
    clearCarouselTimers();
    activeTickerIndex = null;
    focusedTickerIndex = null;
    newsStrip?.classList.remove("is-reading");
    updateTickerSelection();
  };
  const scheduleTickerRelease = (delay = 4800) => {
    window.clearTimeout(carouselResumeTimer);
    carouselResumeTimer = window.setTimeout(() => {
      if (tickerPointerInside || tickerPointerDown) {
        scheduleTickerRelease(6200);
        return;
      }
      clearTickerFocus();
    }, delay);
  };
  const focusReadableTickerItem = (direction = 1) => {
    window.clearTimeout(carouselResumeTimer);
    clearCarouselTimers();
    normalizeTickerScroll();
    const centeredItem = getCenterTickerItem();
    if (!centeredItem) return;
    const centeredIndex = Number(centeredItem.dataset.tickerIndex) || 0;
    const nextIndex = focusedTickerIndex === null
      ? centeredIndex
      : (focusedTickerIndex + direction + tickerItemCount) % tickerItemCount;
    const activeItem = focusedTickerIndex === null
      ? centeredItem
      : getTickerItemByIndex(nextIndex, direction) || centeredItem;
    if (!activeItem) return;

    activeTickerIndex = Number(activeItem.dataset.tickerIndex) || 0;
    focusedTickerIndex = activeTickerIndex;
    newsStrip?.classList.add("is-reading");
    updateTickerSelection();
    scrollTickerItemToStart(activeItem, systemPrefersReducedMotion.matches ? "auto" : "smooth");
    gentlyPanLongTickerItem(activeItem);
    scheduleTickerRelease(tickerPointerInside || tickerPointerDown ? 8200 : 5200);
  };
  const runTickerAutoFlow = (time) => {
    if (!tickerAutoTime) tickerAutoTime = time;
    const delta = Math.min(64, time - tickerAutoTime);
    tickerAutoTime = time;

    if (activeTickerIndex === null && !tickerPointerDown) {
      const maxScroll = Math.max(0, tickerTrack.scrollWidth - tickerTrack.clientWidth);
      if (maxScroll > 1) {
        tickerTrack.scrollLeft += delta * 0.026;
        const loopDistance = getLoopDistance();
        if (loopDistance > 1 && tickerTrack.scrollLeft >= loopDistance) {
          tickerTrack.scrollLeft -= loopDistance;
        }
      }
    }

    tickerAutoFrame = window.requestAnimationFrame(runTickerAutoFlow);
  };

  tickerPrev?.addEventListener("click", () => focusReadableTickerItem(-1));
  tickerNext?.addEventListener("click", () => focusReadableTickerItem(1));
  newsStrip?.addEventListener("pointerenter", () => {
    tickerPointerInside = true;
    if (activeTickerIndex !== null) scheduleTickerRelease(8200);
  });
  newsStrip?.addEventListener("pointerleave", () => {
    tickerPointerInside = false;
    if (activeTickerIndex !== null) scheduleTickerRelease(3600);
  });
  newsStrip?.addEventListener("pointerdown", () => {
    tickerPointerDown = true;
    if (activeTickerIndex !== null) scheduleTickerRelease(9000);
  });
  ["pointerup", "pointercancel"].forEach((eventName) => {
    newsStrip?.addEventListener(eventName, () => {
      tickerPointerDown = false;
      if (activeTickerIndex !== null) scheduleTickerRelease(tickerPointerInside ? 8200 : 3600);
    });
  });
  if (!systemPrefersReducedMotion.matches && !tickerAutoFrame) {
    tickerAutoFrame = window.requestAnimationFrame(runTickerAutoFlow);
  }
};

setupTickerControls();
setupTickerMotion();

// Simple archive search and topic filters.
if (archiveItems.length) {
  let activeFilter = "all";

  const updateArchive = () => {
    const query = archiveSearch?.value.trim().toLowerCase() || "";
    let visibleCount = 0;

    archiveItems.forEach((item) => {
      const text = item.textContent.toLowerCase();
      const topics = (item.dataset.topics || "").split(" ");
      const matchesFilter = activeFilter === "all" || topics.includes(activeFilter);
      const matchesSearch = !query || text.includes(query);
      const isVisible = matchesFilter && matchesSearch;

      item.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    });

    if (archiveEmpty) archiveEmpty.hidden = visibleCount > 0;
  };

  archiveSearch?.addEventListener("input", updateArchive);
  archiveFilters.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.archiveFilter || "all";
      archiveFilters.forEach((filterButton) => {
        filterButton.setAttribute("aria-pressed", String(filterButton === button));
      });
      updateArchive();
    });
  });

  updateArchive();
}

// Keep the header stack visually stable; only scroll progress changes.
if (header) {
  const updateHeader = () => {
    updateScrollProgress();
  };

  updateHeader();
  getHeaderOffset();
  window.addEventListener("scroll", updateHeader, { passive: true });
  window.addEventListener("resize", () => {
    getHeaderOffset();
    updateHeader();
  });
} else {
  updateScrollProgress();
  window.addEventListener("scroll", updateScrollProgress, { passive: true });
  window.addEventListener("resize", updateScrollProgress);
}

// Primary navigation helpers.
const closeMenu = () => {
  if (!menu || !menuToggle) return;
  menu.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open menu");
};

const updateNavOverflow = () => {
  if (!header || !menu) return;
  const hasOverflow = menu.scrollWidth > menu.clientWidth + 2;
  const hasMoreLeft = menu.scrollLeft > 2;
  const hasMoreRight = menu.scrollLeft + menu.clientWidth < menu.scrollWidth - 2;

  header.classList.toggle("has-nav-overflow", hasOverflow);
  header.classList.toggle("has-nav-more-left", hasOverflow && hasMoreLeft);
  header.classList.toggle("has-nav-more-right", hasOverflow && hasMoreRight);
};

const keepNavItemVisible = (item) => {
  if (!menu || !item || menu.scrollWidth <= menu.clientWidth) return;
  const padding = 24;
  const itemLeft = item.offsetLeft;
  const itemRight = itemLeft + item.offsetWidth;
  const viewLeft = menu.scrollLeft;
  const viewRight = viewLeft + menu.clientWidth;
  let nextLeft = viewLeft;

  if (itemLeft < viewLeft + padding) {
    nextLeft = itemLeft - padding;
  } else if (itemRight > viewRight - padding) {
    nextLeft = itemRight - menu.clientWidth + padding;
  }

  const maxLeft = menu.scrollWidth - menu.clientWidth;
  const clampedLeft = Math.max(0, Math.min(maxLeft, nextLeft));
  if (Math.abs(clampedLeft - viewLeft) < 1) return;

  menu.scrollTo({
    left: clampedLeft,
    behavior: systemPrefersReducedMotion.matches ? "auto" : "smooth",
  });
};

if (menu && menuToggle) {
  updateNavOverflow();
  menu.addEventListener("scroll", updateNavOverflow, { passive: true });
  window.addEventListener("resize", updateNavOverflow);

  menu.addEventListener("wheel", (event) => {
    if (menu.scrollWidth <= menu.clientWidth) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    event.preventDefault();
    menu.scrollBy({
      left: event.deltaY,
      behavior: "auto",
    });
  }, { passive: false });

  menuToggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("click", (event) => {
    if (!menu.classList.contains("is-open")) return;
    if (menu.contains(event.target) || menuToggle.contains(event.target)) return;
    closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
    updateThemeButton();
  });
}

// Active page state for the top navigation.
const markCurrentPage = () => {
  const path = window.location.pathname;
  const currentPath = (path.split("/").pop() || "index").replace(/\.html$/i, "");
  let currentLink = null;

  document.querySelectorAll(".site-nav a").forEach((link) => {
    const linkPath = link.getAttribute("href")?.split("#")[0] || "";
    const normalizedLinkPath = (linkPath.split("/").pop() || "index").replace(/\.html$/i, "");
    const isArticlePage = path.includes("/articles/") && normalizedLinkPath === "notes";
    if (normalizedLinkPath === currentPath || isArticlePage) {
      link.setAttribute("aria-current", "page");
      currentLink = link;
    } else if (normalizedLinkPath !== "index") {
      link.removeAttribute("aria-current");
    }
  });

  keepNavItemVisible(currentLink);
  updateNavOverflow();
};

markCurrentPage();

// Reader controls use actual page sections; no visible section rail is needed.
issueSections = issueLinks.length
  ? issueLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean)
  : [];

if (issueLinks.length || issueSections.length) {
  const setActiveLink = (id) => {
    issueLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${id}`;
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const updateActiveSection = () => {
    const marker = window.scrollY + getHeaderOffset() + 2;
    const active = issueSections.reduce((current, section) => {
      return getDocumentTop(section) <= marker ? section : current;
    }, issueSections[0]);

    if (active) {
      activeIssueIndex = issueSections.indexOf(active);
      setActiveLink(active.id);
    }
  };

  issueLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;

      event.preventDefault();
      closeMenu();
      scrollToY(getDocumentTop(target) - getHeaderOffset());
      setActiveLink(target.id);
    });
  });

  updateActiveSection();
  window.addEventListener("scroll", updateActiveSection, { passive: true });
  window.addEventListener("resize", updateActiveSection);
}

// Floating reader controls for section-level movement.
const createReaderControls = () => {
  const controls = document.createElement("div");
  controls.className = "reader-controls";
  controls.setAttribute("data-reader-controls", "");
  controls.setAttribute("aria-label", "Reader controls");

  const previousButton = document.createElement("button");
  previousButton.type = "button";
  previousButton.className = "reader-control";
  previousButton.setAttribute("data-previous-section", "");
  previousButton.setAttribute("aria-label", "Previous section");
  previousButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 19V5M5 12l7-7 7 7"></path></svg>';

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "reader-control";
  nextButton.setAttribute("data-next-section", "");
  nextButton.setAttribute("aria-label", "Next section");
  nextButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12l7 7 7-7"></path></svg>';

  const topButton = document.createElement("button");
  topButton.type = "button";
  topButton.className = "reader-control";
  topButton.setAttribute("data-scroll-top", "");
  topButton.setAttribute("aria-label", "Back to top");
  topButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 7h14M12 19V7M7 12l5-5 5 5"></path></svg>';

  controls.append(topButton);
  if (issueSections.length) {
    controls.append(previousButton);
    controls.append(nextButton);
  }
  document.body.append(controls);

  const updateControls = () => {
    const isVisible = window.scrollY > Math.max(360, window.innerHeight * 0.45);
    controls.classList.toggle("is-visible", isVisible);
    previousButton.disabled = activeIssueIndex <= 0;
    nextButton.disabled = !issueSections.length || activeIssueIndex >= issueSections.length - 1;
  };

  previousButton.addEventListener("click", () => {
    if (!issueSections.length) return;
    const target = issueSections[Math.max(0, activeIssueIndex - 1)];
    if (target) scrollToY(getDocumentTop(target) - getHeaderOffset());
  });

  nextButton.addEventListener("click", () => {
    if (!issueSections.length) return;
    const target = issueSections[Math.min(issueSections.length - 1, activeIssueIndex + 1)];
    if (target) scrollToY(getDocumentTop(target) - getHeaderOffset());
  });

  topButton.addEventListener("click", () => scrollToY(0));

  updateControls();
  window.addEventListener("scroll", updateControls, { passive: true });
  window.addEventListener("resize", updateControls);
};

createReaderControls();
