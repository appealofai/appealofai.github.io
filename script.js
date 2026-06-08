const header = document.querySelector("[data-header]");
const root = document.documentElement;
const menu = document.querySelector("[data-menu]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const issueLinks = Array.from(document.querySelectorAll('.issue-rail a[href^="#"]'));
const currentDate = document.querySelector("[data-current-date]");
const newsStrip = document.querySelector("[data-news-strip]");
const newsLabel = document.querySelector("[data-news-label]");
const tickerTrack = document.querySelector(".ticker-track");
const mastheadNote = document.querySelector("[data-masthead-note]");
const dismissNote = document.querySelector("[data-dismiss-note]");
const topStories = document.querySelector("[data-top-stories]");
const issueStrip = document.querySelector(".issue-strip");
const issueRail = document.querySelector("[data-issue-rail]");
let issueSections = [];
let activeIssueIndex = 0;
let headerLogoIsHidden = false;
let issueStripIsHidden = false;

const systemPrefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
const systemPrefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const systemTheme = systemPrefersLight ? "light" : "dark";
const themeFromUrl = new URLSearchParams(window.location.search).get("theme");
const initialTheme = themeFromUrl === "light" || themeFromUrl === "dark" ? themeFromUrl : systemTheme;
root.dataset.theme = initialTheme;

const cleanThemeUrl = () => {
  if (!themeFromUrl || !window.history.replaceState) return;
  const url = new URL(window.location.href);
  url.searchParams.delete("theme");
  window.history.replaceState({}, "", url.href);
};

const updateThemeButton = () => {
  if (!themeToggle) return;
  const isLight = root.dataset.theme === "light";
  themeToggle.setAttribute("aria-label", isLight ? "Toggle dark mode" : "Toggle light mode");
};

cleanThemeUrl();
updateThemeButton();

// Remove broken optional assets instead of showing empty image frames.
document.querySelectorAll("[data-fallback-remove]").forEach((image) => {
  image.addEventListener("error", () => image.remove(), { once: true });
});

// Keep sticky offsets in CSS so anchor scrolling lands below the header stack.
const getHeaderOffset = () => {
  const height = header?.offsetHeight || 72;
  const newsbarHeight = newsStrip?.offsetHeight || 0;
  const issueStripHeight = issueStrip?.classList.contains("is-hidden") ? 0 : issueStrip?.scrollHeight || 0;
  const issueRailHeight = issueRail?.offsetHeight || 0;
  root.style.setProperty("--header-height", `${height}px`);
  root.style.setProperty("--newsbar-height", `${newsbarHeight}px`);
  root.style.setProperty("--issue-strip-height", `${issueStripHeight}px`);
  root.style.setProperty("--issue-rail-height", `${issueRailHeight}px`);
  return height + newsbarHeight + issueStripHeight + issueRailHeight + 18;
};

if ("ResizeObserver" in window) {
  const stickyMetricObserver = new ResizeObserver(() => {
    window.requestAnimationFrame(getHeaderOffset);
  });
  [header, newsStrip, issueRail].filter(Boolean).forEach((element) => {
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

const renderTickerFromArticles = (items = []) => {
  if (!newsStrip || !tickerTrack || !items.length) return;

  const now = Date.now();
  const maxAgeInDays = 21;
  const activeItems = items
    .filter((item) => item.status === "published" || item.status === "draft")
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
  tickerTrack.replaceChildren(...repeatedItems.map((item) => {
    const span = document.createElement("span");
    span.textContent = item.tickerTitle || item.title;
    return span;
  }));
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

// The masthead note can be dismissed for the current page view only.
if (mastheadNote && dismissNote) {
  dismissNote.addEventListener("click", () => {
    mastheadNote.hidden = true;
  });
}

// Visual header state and scroll progress. Layout height stays stable.
if (header) {
  const updateHeader = () => {
    let compactChanged = false;
    const currentY = window.scrollY;
    updateScrollProgress();

    if (!headerLogoIsHidden && currentY > 28) {
      headerLogoIsHidden = true;
      header.classList.add("is-logo-hidden");
      header.classList.add("is-scrolled");
      compactChanged = true;
    } else if (headerLogoIsHidden && currentY <= 1) {
      headerLogoIsHidden = false;
      header.classList.remove("is-logo-hidden");
      header.classList.remove("is-scrolled");
      compactChanged = true;
    }

    if (issueStrip && !issueStripIsHidden && currentY > 128) {
      issueStripIsHidden = true;
      issueStrip.classList.add("is-hidden");
      compactChanged = true;
    } else if (issueStrip && issueStripIsHidden && currentY < 72) {
      issueStripIsHidden = false;
      issueStrip.classList.remove("is-hidden");
      compactChanged = true;
    }
    if (compactChanged) {
      window.requestAnimationFrame(getHeaderOffset);
    }
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
  const currentPath = path.split("/").pop() || "index.html";
  let currentLink = null;

  document.querySelectorAll(".site-nav a").forEach((link) => {
    const linkPath = link.getAttribute("href")?.split("#")[0] || "";
    const isArticlePage = path.includes("/articles/") && linkPath.includes("articles.html");
    if (linkPath === currentPath || isArticlePage) {
      link.setAttribute("aria-current", "page");
      currentLink = link;
    } else if (link.getAttribute("href") !== "index.html") {
      link.removeAttribute("aria-current");
    }
  });

  keepNavItemVisible(currentLink);
  updateNavOverflow();
};

markCurrentPage();

// Section rail state for the journal front page.
if (issueLinks.length) {
  root.classList.add("has-issue-rail");

  issueSections = issueLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

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

// Featured story carousel.
if (topStories) {
  const slides = Array.from(topStories.querySelectorAll("[data-story-slide]"));
  const prevButton = topStories.querySelector("[data-story-prev]");
  const nextButton = topStories.querySelector("[data-story-next]");
  const storyCounter = topStories.querySelector("[data-story-counter]");
  let activeStory = Math.max(0, slides.findIndex((slide) => slide.classList.contains("is-active")));

  const setActiveStory = (index, direction = 1) => {
    topStories.dataset.storyDirection = direction < 0 ? "previous" : "next";
    activeStory = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeStory;
      slide.classList.toggle("is-active", isActive);
      slide.setAttribute("aria-hidden", String(!isActive));
    });
    if (storyCounter) storyCounter.textContent = `${activeStory + 1} / ${slides.length}`;
  };

  if (slides.length > 1) {
    topStories.classList.add("is-slider-ready");
    topStories.dataset.storyDirection = "next";
    prevButton?.addEventListener("click", () => setActiveStory(activeStory - 1, -1));
    nextButton?.addEventListener("click", () => setActiveStory(activeStory + 1, 1));
    setActiveStory(activeStory, 1);
  }
}

// Utility for future copy buttons on source or embed fields.
document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.querySelector(button.dataset.copyTarget);
    const status = button.parentElement?.querySelector("[data-copy-status]");

    if (!target) return;

    try {
      await navigator.clipboard.writeText(target.value || target.textContent);
      if (status) status.textContent = "Copied";
    } catch {
      if (status) status.textContent = "Select and copy manually";
    }
  });
});
