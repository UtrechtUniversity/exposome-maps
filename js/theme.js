// Light/dark theme. Loaded as a classic script in <head> (not a module) so the
// theme is applied before the first paint. Follows the operating-system setting
// until the visitor picks a theme with a [data-theme-toggle] button; that choice
// is remembered. Fires a "themechange" event on window (used by the map).
(function () {
  var KEY = "exposome-maps:theme";
  var media = window.matchMedia("(prefers-color-scheme: dark)");

  function stored() {
    try {
      var value = localStorage.getItem(KEY);
      return value === "dark" || value === "light" ? value : null;
    } catch (e) {
      return null;
    }
  }

  function current() {
    return stored() || (media.matches ? "dark" : "light");
  }

  function apply() {
    var theme = current();
    document.documentElement.setAttribute("data-theme", theme);
    var buttons = document.querySelectorAll("[data-theme-toggle]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", String(theme === "dark"));
      buttons[i].title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    }
    window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  }

  apply();

  media.addEventListener("change", function () {
    if (!stored()) apply();
  });

  document.addEventListener("DOMContentLoaded", function () {
    var buttons = document.querySelectorAll("[data-theme-toggle]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () {
        try {
          localStorage.setItem(KEY, current() === "dark" ? "light" : "dark");
        } catch (e) {
          /* storage unavailable: the choice lasts for this page only */
        }
        apply();
      });
    }
    apply();
  });
})();
