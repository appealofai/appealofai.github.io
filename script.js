const header = document.querySelector("[data-header]");
const root = document.documentElement;
const menu = document.querySelector("[data-menu]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const sectionLinks = Array.from(document.querySelectorAll('.site-nav a[href^="#"]'));
const currentDate = document.querySelector("[data-current-date]");
const newsStrip = document.querySelector("[data-news-strip]");
const newsLabel = document.querySelector("[data-news-label]");
const masthead = document.querySelector(".issue-masthead");
const topStories = document.querySelector("[data-top-stories]");

const storedTheme = localStorage.getItem("appeal-theme");
const systemPrefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
const initialTheme = storedTheme || (systemPrefersLight ? "light" : "dark");
root.dataset.theme = initialTheme;

const updateThemeButton = () => {
  if (!themeToggle) return;
  const isLight = root.dataset.theme === "light";
  themeToggle.setAttribute("aria-label", isLight ? "Toggle dark mode" : "Toggle light mode");
};

updateThemeButton();

const getHeaderOffset = () => {
  const height = header?.offsetHeight || 72;
  const newsbarHeight = newsStrip?.offsetHeight || 0;
  root.style.setProperty("--header-height", `${height}px`);
  return height + newsbarHeight + 18;
};

const formatIssueDate = () => {
  if (!currentDate) return;
  currentDate.textContent = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
};

const updateNewsLabel = () => {
  if (!newsStrip || !newsLabel) return;
  const lastUpdated = new Date(newsStrip.dataset.lastUpdated);
  if (Number.isNaN(lastUpdated.getTime())) return;

  const ageInHours = (Date.now() - lastUpdated.getTime()) / 36e5;
  if (ageInHours <= 36) {
    newsLabel.textContent = "Breaking";
    newsStrip.dataset.status = "breaking";
  } else if (ageInHours <= 168) {
    newsLabel.textContent = "Latest";
    newsStrip.dataset.status = "latest";
  } else {
    newsLabel.textContent = "Archive";
    newsStrip.dataset.status = "archive";
  }
};

formatIssueDate();
updateNewsLabel();

if (header) {
  const updateHeader = () => {
    getHeaderOffset();
    header.classList.toggle("is-scrolled", window.scrollY > 12);
    if (masthead) {
      const mastheadBottom = masthead.offsetTop + masthead.offsetHeight;
      header.classList.toggle("show-brand", window.scrollY > mastheadBottom - header.offsetHeight);
    }
  };

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
  window.addEventListener("resize", updateHeader);
}

const closeMenu = () => {
  if (!menu || !menuToggle) return;
  menu.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open menu");
};

if (menu && menuToggle) {
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
    localStorage.setItem("appeal-theme", root.dataset.theme);
    updateThemeButton();
  });
}

if (sectionLinks.length) {
  const sections = sectionLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const setActiveLink = (id) => {
    sectionLinks.forEach((link) => {
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
    const active = sections.reduce((current, section) => {
      return section.offsetTop <= marker ? section : current;
    }, sections[0]);

    if (active) setActiveLink(active.id);
  };

  sectionLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;

      event.preventDefault();
      closeMenu();
      window.scrollTo({
        top: Math.max(0, target.offsetTop - getHeaderOffset()),
        behavior: "smooth",
      });
      setActiveLink(target.id);
    });
  });

  updateActiveSection();
  window.addEventListener("scroll", updateActiveSection, { passive: true });
  window.addEventListener("resize", updateActiveSection);
}

if (topStories) {
  const slides = Array.from(topStories.querySelectorAll("[data-story-slide]"));
  const prevButton = topStories.querySelector("[data-story-prev]");
  const nextButton = topStories.querySelector("[data-story-next]");
  const dotsContainer = topStories.querySelector("[data-story-dots]");
  let activeStory = Math.max(0, slides.findIndex((slide) => slide.classList.contains("is-active")));

  const dots = slides.map((_, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `Show top story ${index + 1}`);
    button.addEventListener("click", () => setActiveStory(index));
    dotsContainer?.append(button);
    return button;
  });

  const setActiveStory = (index) => {
    activeStory = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeStory;
      slide.classList.toggle("is-active", isActive);
      slide.setAttribute("aria-hidden", String(!isActive));
    });
    dots.forEach((dot, dotIndex) => {
      dot.setAttribute("aria-current", String(dotIndex === activeStory));
    });
  };

  if (slides.length > 1) {
    topStories.classList.add("is-slider-ready");
    prevButton?.addEventListener("click", () => setActiveStory(activeStory - 1));
    nextButton?.addEventListener("click", () => setActiveStory(activeStory + 1));
    setActiveStory(activeStory);
  }
}

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
