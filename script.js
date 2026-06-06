const header = document.querySelector("[data-header]");
const root = document.documentElement;
const menu = document.querySelector("[data-menu]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const themeToggle = document.querySelector("[data-theme-toggle]");

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

if (header) {
  const updateHeader = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
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
