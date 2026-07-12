(function () {
  const storageKey = "cognitive-shift-theme";
  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let storedTheme = null;

  try {
    storedTheme = window.localStorage.getItem(storageKey);
  } catch (error) {
    storedTheme = null;
  }

  root.dataset.theme = storedTheme === "dark" || storedTheme === "light"
    ? storedTheme
    : systemTheme.matches ? "dark" : "light";

  const mountThemeToggle = () => {
    if (document.querySelector(".theme-toggle")) return;

    const button = document.createElement("button");
    button.className = "theme-toggle";
    button.type = "button";
    button.innerHTML = `
      <svg class="theme-toggle-sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"></circle>
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
      </svg>
      <svg class="theme-toggle-moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 15.3A8.2 8.2 0 0 1 8.7 4a8.3 8.3 0 1 0 11.3 11.3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path>
      </svg>
      <span class="theme-toggle-thumb" aria-hidden="true"></span>
    `;

    const syncButton = () => {
      const isDark = root.dataset.theme === "dark";
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      button.title = isDark ? "Light mode" : "Dark mode";
    };

    button.addEventListener("click", () => {
      const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = nextTheme;
      try {
        window.localStorage.setItem(storageKey, nextTheme);
      } catch (error) {
        // Keep the theme active for the current session if storage is unavailable.
      }
      syncButton();
    });

    document.body.appendChild(button);
    syncButton();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountThemeToggle, { once: true });
  } else {
    mountThemeToggle();
  }
})();
