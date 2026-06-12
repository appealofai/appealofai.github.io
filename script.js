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

// Remove broken optional assets instead of showing empty image frames.
document.querySelectorAll("[data-fallback-remove]").forEach((image) => {
  image.addEventListener("error", () => image.remove(), { once: true });
});

// Keep sticky offsets in CSS so anchor scrolling lands below the header stack.
const getHeaderOffset = () => {
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
    window.requestAnimationFrame(getHeaderOffset);
  });
  [header, newsStrip, issueStrip].filter(Boolean).forEach((element) => {
    stickyMetricObserver.observe(element);
  });
}

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

  const repeatedItems = [...tickerItems, ...tickerItems];
  tickerItemCount = tickerItems.length;
  activeTickerIndex = null;
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
    if (isActive) {
      item.setAttribute("aria-current", "true");
    } else {
      item.removeAttribute("aria-current");
    }
  });
};

const setupTickerMotion = () => {
  if (!tickerTrack) return;
  setupTickerControls();
  ensureTickerItemIndexes();
  if (tickerTrack.dataset.motionReady === "true") return;
  tickerTrack.dataset.motionReady = "true";
  let frame = 0;
  let currentRate = 1;
  let targetRate = 1;
  let resumeTimer = 0;

  const step = () => {
    currentRate += (targetRate - currentRate) * 0.12;
    tickerTrack.getAnimations().forEach((animation) => {
      animation.playbackRate = currentRate;
    });

    if (Math.abs(targetRate - currentRate) > 0.01) {
      frame = window.requestAnimationFrame(step);
    } else {
      currentRate = targetRate;
      frame = 0;
    }
  };

  const setRate = (rate) => {
    targetRate = rate;
    if (!frame) frame = window.requestAnimationFrame(step);
  };

  const slowTicker = () => setRate(0.42);
  const touchTicker = () => setRate(0.24);
  const restoreTicker = () => setRate(1);
  const pauseTicker = () => {
    tickerTrack.getAnimations().forEach((animation) => animation.pause());
  };
  const resumeTicker = () => {
    tickerTrack.getAnimations().forEach((animation) => animation.play());
    restoreTicker();
  };
  const animateTickerToTime = (animation, targetTime, duration) => {
    const startTime = Number(animation.currentTime) || 0;
    let endTime = targetTime;
    const halfDuration = duration / 2;

    if (Math.abs(endTime - startTime) > halfDuration) {
      endTime += endTime > startTime ? -duration : duration;
    }

    const startedAt = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    pauseTicker();

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / 460);
      const eased = ease(progress);
      animation.currentTime = ((startTime + (endTime - startTime) * eased) % duration + duration) % duration;

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      } else {
        pauseTicker();
      }
    };

    window.requestAnimationFrame(tick);
  };
  const getTickerReadingBounds = () => {
    const stripRect = newsStrip.getBoundingClientRect();
    const labelWidth = newsLabel?.getBoundingClientRect().width || 92;
    const edgeWidth = Number.parseFloat(getComputedStyle(newsStrip).getPropertyValue("--ticker-edge-width")) || 56;
    const inset = edgeWidth + 8;
    return {
      left: stripRect.left + labelWidth + inset,
      right: stripRect.right - inset,
      width: Math.max(120, stripRect.width - labelWidth - inset * 2),
    };
  };
  const getUniqueTickerItems = () => {
    const seen = new Set();
    return Array.from(tickerTrack.querySelectorAll("[data-ticker-index]")).filter((item) => {
      const index = item.dataset.tickerIndex;
      if (seen.has(index)) return false;
      seen.add(index);
      return true;
    });
  };
  const getTickerItems = () => Array.from(tickerTrack.querySelectorAll("[data-ticker-index]"));
  const getMostVisibleTickerIndex = () => {
    const bounds = getTickerReadingBounds();
    const winner = getTickerItems().reduce((best, item) => {
      const rect = item.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left));
      return visible > best.visible ? { visible, index: Number(item.dataset.tickerIndex) } : best;
    }, { visible: 0, index: 0 });

    return Number.isFinite(winner.index) ? winner.index : 0;
  };
  const getBestActiveTickerItem = (index, targetCenter, travelDistance, duration, tickerAnimation) => {
    if (!travelDistance || !duration) return null;
    const currentTime = Number(tickerAnimation.currentTime) || 0;
    return getTickerItems()
      .filter((item) => Number(item.dataset.tickerIndex) === index)
      .map((item) => {
        const itemCenter = item.offsetLeft + item.offsetWidth / 2;
        const desiredTranslate = targetCenter - tickerTrack.offsetLeft - itemCenter;
        const progress = ((-desiredTranslate / travelDistance) % 1 + 1) % 1;
        const targetTime = progress * duration;
        const delta = Math.abs(((targetTime - currentTime + duration / 2) % duration) - duration / 2);
        return { item, targetTime, delta };
      })
      .sort((a, b) => a.delta - b.delta)[0];
  };
  const nudgeTicker = (direction) => {
    window.clearTimeout(resumeTimer);
    const items = getUniqueTickerItems();
    const itemCount = tickerItemCount || items.length || 1;
    const currentIndex = activeTickerIndex ?? getMostVisibleTickerIndex();
    activeTickerIndex = activeTickerIndex === null
      ? (currentIndex + direction + itemCount) % itemCount
      : (activeTickerIndex + direction + itemCount) % itemCount;
    updateTickerSelection();
    const animations = tickerTrack.getAnimations();
    const tickerAnimation = animations[0];
    let activeItem = items.find((item) => Number(item.dataset.tickerIndex) === activeTickerIndex)
      || tickerTrack.querySelector(`[data-ticker-index="${activeTickerIndex}"]`);

    if (tickerAnimation && activeItem && !systemPrefersReducedMotion.matches) {
      const timing = tickerAnimation.effect?.getTiming();
      const duration = Number(timing?.duration) || 38000;
      const travelDistance = tickerTrack.scrollWidth / 2;
      const bounds = getTickerReadingBounds();
      const stripRect = newsStrip.getBoundingClientRect();
      const itemWidth = activeItem.getBoundingClientRect().width;
      const targetCenter = itemWidth > bounds.width
        ? bounds.left - stripRect.left + itemWidth / 2
        : (bounds.left + bounds.right) / 2 - stripRect.left;
      const bestItem = getBestActiveTickerItem(activeTickerIndex, targetCenter, travelDistance, duration, tickerAnimation);
      activeItem = bestItem?.item || activeItem;
      animateTickerToTime(tickerAnimation, bestItem?.targetTime ?? 0, duration);
    } else {
      activeItem?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }

    resumeTimer = window.setTimeout(resumeTicker, 4200);
  };

  if (!systemPrefersReducedMotion.matches) {
    tickerTrack.addEventListener("pointerenter", slowTicker);
    tickerTrack.addEventListener("pointerleave", restoreTicker);
    tickerTrack.addEventListener("focusin", slowTicker);
    tickerTrack.addEventListener("focusout", restoreTicker);
    newsStrip?.addEventListener("pointerdown", touchTicker);
    newsStrip?.addEventListener("pointerup", restoreTicker);
    newsStrip?.addEventListener("pointercancel", restoreTicker);
  }

  tickerPrev?.addEventListener("click", () => nudgeTicker(-1));
  tickerNext?.addEventListener("click", () => nudgeTicker(1));
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
