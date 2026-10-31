// Applies the saved theme before first paint (loaded synchronously in <head>, CSP-safe: same origin).
// Preference in localStorage "diary-theme": "system" (default) | "light" | "dark".
(function () {
  var KEY = "diary-theme";
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function apply() {
    var pref = "system";
    try { pref = localStorage.getItem(KEY) || "system"; } catch (e) {}
    var dark = pref === "dark" || (pref === "system" && media.matches);
    document.documentElement.classList.toggle("dark", dark);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#141210" : "#f7f3ec");
  }
  apply();
  if (media.addEventListener) media.addEventListener("change", apply);
  window.addEventListener("storage", apply); // other tabs
  window.diaryTheme = {
    get: function () { try { return localStorage.getItem(KEY) || "system"; } catch (e) { return "system"; } },
    set: function (pref) { try { localStorage.setItem(KEY, pref); } catch (e) {} apply(); },
  };
})();
