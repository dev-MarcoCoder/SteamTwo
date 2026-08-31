export const THEME_KEY = "steamtwo:theme";

export function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

export function getPreferredTheme() {
  return getStoredTheme() ?? (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark");
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private browsing or storage disabled — theme just won't persist across visits.
  }
}
