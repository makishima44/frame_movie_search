const STORAGE_KEY = "movieSearch.theme";
const themeToggle = document.getElementById("themeToggle");
const themeColor = document.querySelector('meta[name="theme-color"]');

/** Применяет палитру и обновляет подпись кнопки и цвет панели браузера. */
function applyTheme(theme) {
  const selectedTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = selectedTheme;
  themeToggle.setAttribute("aria-label", `Switch to ${selectedTheme === "dark" ? "light" : "dark"} theme`);
  themeToggle.title = `Switch to ${selectedTheme === "dark" ? "light" : "dark"} theme`;
  themeToggle.innerHTML = `<span aria-hidden="true">${selectedTheme === "dark" ? "☼" : "☾"}</span>`;
  themeColor.content = selectedTheme === "dark" ? "#101114" : "#f5f6f2";
}

/** Загружает сохранённую тему и включает переключение светлого/тёмного оформления. */
export function initializeTheme() {
  const savedTheme = (() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  })();

  applyTheme(savedTheme || document.documentElement.dataset.theme);
  themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // The theme still applies for this page view when storage is unavailable.
    }
  });
}
