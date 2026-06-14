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
const archiveItems = Array.from(document.querySelectorAll("[data-archive-item]"));
const archiveTopic = document.querySelector("[data-archive-topic]");
const archiveOrder = document.querySelector("[data-archive-order]");
const archiveCount = document.querySelector("[data-archive-count]");
const archiveEmpty = document.querySelector("[data-archive-empty]");
let issueSections = [];
let activeIssueIndex = 0;

const systemPrefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
const systemPrefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const systemTheme = systemPrefersLight ? "light" : "dark";
const themeFromUrl = new URLSearchParams(window.location.search).get("theme");
const usesLocalStaticServer = ["localhost", "127.0.0.1", "0.0.0.0", ""].includes(window.location.hostname);
const getStoredTheme = () => {
  try {
    if (getThemeStorageConsent() !== "granted") return null;
    return window.localStorage?.getItem("appealofai-theme");
  } catch {
    return null;
  }
};
const getThemeStorageConsent = () => {
  try {
    return window.localStorage?.getItem("appealofai-theme-consent");
  } catch {
    return null;
  }
};
const setStoredTheme = (theme) => {
  try {
    window.localStorage?.setItem("appealofai-theme-consent", "granted");
    window.localStorage?.setItem("appealofai-theme", theme);
  } catch {
    // Theme still works for the current page when storage is unavailable.
  }
};
const storedTheme = getStoredTheme();
const initialTheme = themeFromUrl === "light" || themeFromUrl === "dark"
  ? themeFromUrl
  : storedTheme === "light" || storedTheme === "dark"
    ? storedTheme
    : systemTheme;
root.dataset.theme = initialTheme;

document.addEventListener("gesturestart", (event) => {
  event.preventDefault();
}, { passive: false });

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

const resetInitialScroll = () => {
  if (window.location.hash) return;
  window.scrollTo(0, 0);
};

const getCleanDisplayUrl = (href) => {
  const url = new URL(href, window.location.href);
  if (url.protocol === "file:" || usesLocalStaticServer) return url.href;

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

const showThemeStoragePrompt = () => {
  if (getThemeStorageConsent() === "granted") {
    setStoredTheme(root.dataset.theme);
    return;
  }
  if (document.querySelector("[data-theme-storage-prompt]")) return;

  const prompt = document.createElement("div");
  prompt.className = "theme-storage-prompt";
  prompt.setAttribute("data-theme-storage-prompt", "");
  prompt.setAttribute("role", "dialog");
  prompt.setAttribute("aria-live", "polite");
  prompt.innerHTML = `
    <p>Save this theme choice on this device?</p>
    <div>
      <button type="button" data-theme-save>Save</button>
      <button type="button" data-theme-once>Only now</button>
    </div>
  `;
  document.body.append(prompt);

  prompt.querySelector("[data-theme-save]")?.addEventListener("click", () => {
    setStoredTheme(root.dataset.theme);
    prompt.remove();
  });
  prompt.querySelector("[data-theme-once]")?.addEventListener("click", () => {
    prompt.remove();
  });
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
      if (window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
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

// Carry the active theme across internal pages.
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
  const repeatedItems = tickerItems.length > 1
    ? [...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems]
    : tickerItems;
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
  let tickerAutoResumeAt = 0;
  let tickerLastScrollLeft = tickerTrack.scrollLeft;
  let tickerLastMovementAt = performance.now();
  let tickerReadPanFrame = 0;
  const clearCarouselTimers = () => {
    carouselPanTimers.forEach((timer) => window.clearTimeout(timer));
    carouselPanTimers = [];
    if (tickerReadPanFrame) {
      window.cancelAnimationFrame(tickerReadPanFrame);
      tickerReadPanFrame = 0;
    }
  };
  const animateTickerScrollTo = (target, duration = 5200) => {
    if (systemPrefersReducedMotion.matches) {
      tickerTrack.scrollLeft = target;
      return;
    }

    if (tickerReadPanFrame) window.cancelAnimationFrame(tickerReadPanFrame);
    const start = tickerTrack.scrollLeft;
    const distance = target - start;
    if (Math.abs(distance) < 1) return;

    const startedAt = performance.now();
    const easeInOut = (progress) => progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    const step = (time) => {
      const progress = Math.min(1, (time - startedAt) / duration);
      tickerTrack.scrollLeft = start + distance * easeInOut(progress);
      if (progress < 1) {
        tickerReadPanFrame = window.requestAnimationFrame(step);
      } else {
        tickerReadPanFrame = 0;
      }
    };

    tickerReadPanFrame = window.requestAnimationFrame(step);
  };
  const getCarouselTickerItems = () => Array.from(tickerTrack.querySelectorAll("[data-ticker-index]"));
  const getLoopDistance = () => {
    return tickerItemCount > 1 ? tickerTrack.scrollWidth / 4 : Math.max(0, tickerTrack.scrollWidth - tickerTrack.clientWidth);
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
    const getMatchingItems = () => getCarouselTickerItems()
      .filter((item) => Number(item.dataset.tickerIndex) === normalizedIndex);
    let items = getMatchingItems();
    if (!items.length) return null;

    const getMoves = () => {
      const trackRect = tickerTrack.getBoundingClientRect();
      const readableLeft = trackRect.left;
      return items
      .map((item) => {
        const text = item.querySelector(".ticker-text") || item;
        const target = tickerTrack.scrollLeft + text.getBoundingClientRect().left - readableLeft;
        return { item, target };
      });
    };

    let moves = getMoves()
      .filter((entry) => direction > 0 ? entry.target > tickerTrack.scrollLeft + 2 : entry.target < tickerTrack.scrollLeft - 2)
      .sort((a, b) => direction > 0 ? a.target - b.target : b.target - a.target);

    if (!moves.length) {
      const loopDistance = getLoopDistance();
      if (loopDistance > 1) {
        tickerTrack.scrollLeft += direction > 0 ? -loopDistance : loopDistance;
        items = getMatchingItems();
        moves = getMoves()
          .filter((entry) => direction > 0 ? entry.target > tickerTrack.scrollLeft + 2 : entry.target < tickerTrack.scrollLeft - 2)
          .sort((a, b) => direction > 0 ? a.target - b.target : b.target - a.target);
      }
    }

    if (moves.length) return moves[0].item;

    return getMoves()
      .sort((a, b) => Math.abs(a.target - tickerTrack.scrollLeft) - Math.abs(b.target - tickerTrack.scrollLeft))[0]?.item || items[0];
  };
  const gentlyPanLongTickerItem = (item) => {
    const text = item?.querySelector(".ticker-text") || item;
    if (!text || text.getBoundingClientRect().width <= tickerTrack.clientWidth - 24) return;
    const trackRect = tickerTrack.getBoundingClientRect();
    const textRect = text.getBoundingClientRect();
    const maxScroll = Math.max(0, tickerTrack.scrollWidth - tickerTrack.clientWidth);
    const rightTarget = Math.min(maxScroll, Math.max(0, tickerTrack.scrollLeft + textRect.right - trackRect.right + 12));
    carouselPanTimers.push(window.setTimeout(() => {
      animateTickerScrollTo(rightTarget, 7200);
    }, 1800));
    carouselPanTimers.push(window.setTimeout(() => {
      animateTickerScrollTo(Math.max(0, tickerTrack.scrollLeft + text.getBoundingClientRect().left - tickerTrack.getBoundingClientRect().left), 3600);
    }, 10600));
  };
  const clearTickerFocus = () => {
    clearCarouselTimers();
    activeTickerIndex = null;
    focusedTickerIndex = null;
    newsStrip?.classList.remove("is-reading");
    updateTickerSelection();
    tickerAutoResumeAt = performance.now() + 1250;
  };
  const holdTickerAutoFlow = (delay = 2200) => {
    tickerAutoResumeAt = Math.max(tickerAutoResumeAt, performance.now() + delay);
  };
  const scheduleTickerRelease = (delay = 6200) => {
    window.clearTimeout(carouselResumeTimer);
    carouselResumeTimer = window.setTimeout(() => {
      if (tickerPointerInside || tickerPointerDown) {
        scheduleTickerRelease(7600);
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
    const baseIndex = focusedTickerIndex === null ? centeredIndex : focusedTickerIndex;
    const nextIndex = (baseIndex + direction + tickerItemCount) % tickerItemCount;
    const activeItem = getTickerItemByIndex(nextIndex, direction) || centeredItem;
    if (!activeItem) return;

    activeTickerIndex = Number(activeItem.dataset.tickerIndex) || 0;
    focusedTickerIndex = activeTickerIndex;
    newsStrip?.classList.add("is-reading");
    updateTickerSelection();
    scrollTickerItemToStart(activeItem, systemPrefersReducedMotion.matches ? "auto" : "smooth");
    gentlyPanLongTickerItem(activeItem);
    holdTickerAutoFlow(tickerPointerInside || tickerPointerDown ? 15000 : 12500);
    scheduleTickerRelease(tickerPointerInside || tickerPointerDown ? 15000 : 12500);
  };
  const runTickerAutoFlow = (time) => {
    if (!tickerAutoTime) tickerAutoTime = time;
    const delta = Math.min(64, time - tickerAutoTime);
    tickerAutoTime = time;

    if (activeTickerIndex === null && !tickerPointerDown && time >= tickerAutoResumeAt) {
      const maxScroll = Math.max(0, tickerTrack.scrollWidth - tickerTrack.clientWidth);
      if (maxScroll > 1) {
        const autoSpeed = systemPrefersReducedMotion.matches ? 0.018 : (tickerPointerInside ? 0.014 : 0.055);
        tickerTrack.scrollLeft += delta * autoSpeed;
        if (Math.abs(tickerTrack.scrollLeft - tickerLastScrollLeft) > 0.2) {
          tickerLastMovementAt = time;
          tickerLastScrollLeft = tickerTrack.scrollLeft;
        } else if (time - tickerLastMovementAt > 1800) {
          tickerTrack.scrollLeft += 1;
          tickerLastMovementAt = time;
          tickerLastScrollLeft = tickerTrack.scrollLeft;
        }
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
    if (activeTickerIndex !== null) scheduleTickerRelease(9600);
  });
  newsStrip?.addEventListener("pointerleave", () => {
    tickerPointerInside = false;
    if (activeTickerIndex !== null) scheduleTickerRelease(5200);
  });
  newsStrip?.addEventListener("pointerdown", () => {
    tickerPointerDown = true;
    holdTickerAutoFlow(3600);
    if (activeTickerIndex !== null) scheduleTickerRelease(10400);
  });
  ["pointerup", "pointercancel"].forEach((eventName) => {
    newsStrip?.addEventListener(eventName, () => {
      tickerPointerDown = false;
      holdTickerAutoFlow(2800);
      if (activeTickerIndex !== null) scheduleTickerRelease(tickerPointerInside ? 9600 : 5200);
    });
  });
  ["pointermove", "touchmove", "wheel"].forEach((eventName) => {
    newsStrip?.addEventListener(eventName, () => {
      if (eventName !== "pointermove" || tickerPointerDown) {
        holdTickerAutoFlow(tickerPointerDown ? 3600 : 1800);
      }
      if (activeTickerIndex !== null) scheduleTickerRelease(tickerPointerInside || tickerPointerDown ? 9600 : 5200);
    }, { passive: true });
  });
  if (!tickerAutoFrame) {
    tickerAutoFrame = window.requestAnimationFrame(runTickerAutoFlow);
  }
};

setupTickerControls();
setupTickerMotion();

// Archive search, topic filter and ordering.
if (archiveItems.length) {
  const archiveList = archiveItems[0].parentElement;
  if (archiveList) archiveList.dataset.archiveList = "true";

  const getArchiveTimestamp = (item) => {
    const timestamp = new Date(item.dataset.date || "").getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  const sortArchiveItems = (activeSort) => {
    if (!archiveList) return;
    const sortedItems = [...archiveItems].sort((a, b) => {
      const diff = getArchiveTimestamp(b) - getArchiveTimestamp(a);
      return activeSort === "oldest" ? -diff : diff;
    });

    sortedItems.forEach((item) => {
      archiveList.insertBefore(item, archiveEmpty || null);
    });
  };

  const formatArchiveCount = (visibleCount, query, activeTopic) => {
    const total = archiveItems.length;
    if (!visibleCount) return "No notes found.";
    if (!query && activeTopic === "all") {
      return visibleCount === total ? "Showing all notes." : `Showing ${visibleCount} of ${total} notes.`;
    }
    return `Showing ${visibleCount} ${visibleCount === 1 ? "note" : "notes"}.`;
  };

  const updateArchive = () => {
    const query = archiveSearch?.value.trim().toLowerCase() || "";
    const activeTopic = archiveTopic?.value || "all";
    const activeSort = archiveOrder?.value || "newest";
    const visibleItems = [];
    let visibleCount = 0;

    archiveList?.classList.add("is-updating");
    sortArchiveItems(activeSort);

    archiveItems.forEach((item) => {
      const text = item.textContent.toLowerCase();
      const topics = (item.dataset.topics || "").split(" ");
      const matchesTopic = activeTopic === "all" || topics.includes(activeTopic);
      const matchesSearch = !query || text.includes(query);
      const isVisible = matchesTopic && matchesSearch;

      item.hidden = !isVisible;
      item.classList.remove("is-appearing");
      if (isVisible) {
        visibleCount += 1;
        visibleItems.push(item);
      }
    });

    if (archiveEmpty) archiveEmpty.hidden = visibleCount > 0;
    if (archiveCount) {
      archiveCount.classList.remove("is-changing");
      void archiveCount.offsetWidth;
      archiveCount.textContent = formatArchiveCount(visibleCount, query, activeTopic);
      archiveCount.classList.add("is-changing");
    }

    requestAnimationFrame(() => {
      visibleItems.forEach((item, index) => {
        window.setTimeout(() => item.classList.add("is-appearing"), Math.min(index * 24, 120));
      });
      window.setTimeout(() => archiveList?.classList.remove("is-updating"), 280);
    });
  };

  archiveSearch?.addEventListener("input", updateArchive);
  archiveTopic?.addEventListener("change", updateArchive);
  archiveOrder?.addEventListener("change", updateArchive);

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
    showThemeStoragePrompt();
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

const articleToc = document.querySelector(".article-aside");
if (articleToc) {
  const tocLinks = Array.from(articleToc.querySelectorAll('a[href^="#"]'));
  const tocTargets = tocLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const setActiveTocLink = (targetId) => {
    tocLinks.forEach((link) => {
      if (link.getAttribute("href") === `#${targetId}`) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const updateActiveToc = () => {
    if (!tocTargets.length) return;
    const marker = window.scrollY + getHeaderOffset() + articleToc.offsetHeight + 28;
    const activeTarget = tocTargets.reduce((current, target) => {
      return getDocumentTop(target) <= marker ? target : current;
    }, tocTargets[0]);
    if (activeTarget?.id) setActiveTocLink(activeTarget.id);
  };

  tocLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      scrollToY(getDocumentTop(target) - getHeaderOffset() - articleToc.offsetHeight - 14);
      setActiveTocLink(target.id);
    });
  });

  updateActiveToc();
  window.addEventListener("scroll", updateActiveToc, { passive: true });
  window.addEventListener("resize", updateActiveToc);
}

const sourceFootnotes = Array.from(document.querySelectorAll('.article-body sup a[href^="#source-"]'));
if (sourceFootnotes.length) {
  const highlightSource = (source) => {
    source.classList.remove("is-source-highlight");
    void source.offsetWidth;
    source.classList.add("is-source-highlight");
    window.setTimeout(() => source.classList.remove("is-source-highlight"), 1900);
  };

  sourceFootnotes.forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;

      event.preventDefault();
      scrollToY(getDocumentTop(target) - getHeaderOffset() - 18);
      highlightSource(target);
      target.setAttribute("tabindex", "-1");
      window.setTimeout(() => target.focus({ preventScroll: true }), systemPrefersReducedMotion.matches ? 0 : 320);
      window.history.replaceState(null, "", link.getAttribute("href"));
    });
  });

  if (window.location.hash.startsWith("#source-")) {
    const initialSource = document.querySelector(window.location.hash);
    if (initialSource) {
      window.setTimeout(() => {
        scrollToY(getDocumentTop(initialSource) - getHeaderOffset() - 18);
        highlightSource(initialSource);
      }, 260);
    }
  }
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
