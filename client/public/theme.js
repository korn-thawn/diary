// Applies the saved theme before first paint (loaded synchronously in <head>, CSP-safe: same origin).
// - "diary-theme": "system" (default) | "light" | "dark"
// - "diary-appearance": { css, paper: { light, dark } } built by client/src/appearance.js from the
//   user's colors / fonts / text size (cached so there is no flash of the default look)
(function () {
  var KEY = "diary-theme";
  var USER = "diary-appearance";
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  var user = null;

  function readUser() {
    try { user = JSON.parse(localStorage.getItem(USER) || "null"); } catch (e) { user = null; }
  }
  function applyUser() {
    var el = document.getElementById("user-theme");
    var css = user && typeof user.css === "string" ? user.css : "";
    if (!css) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("style");
      el.id = "user-theme";
      document.head.appendChild(el);
    }
    if (el.textContent !== css) el.textContent = css;
  }
  function apply() {
    var pref = "system";
    try { pref = localStorage.getItem(KEY) || "system"; } catch (e) {}
    var dark = pref === "dark" || (pref === "system" && media.matches);
    document.documentElement.classList.toggle("dark", dark);
    var paper = user && user.paper ? (dark ? user.paper.dark : user.paper.light) : null;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", paper || (dark ? "#1c2a21" : "#fbf5e6"));
  }
  readUser();
  applyUser();
  apply();
  if (media.addEventListener) media.addEventListener("change", apply);
  window.addEventListener("storage", function () { readUser(); applyUser(); apply(); }); // other tabs
  window.diaryTheme = {
    get: function () { try { return localStorage.getItem(KEY) || "system"; } catch (e) { return "system"; } },
    set: function (pref) { try { localStorage.setItem(KEY, pref); } catch (e) {} apply(); },
    // called by the app with the freshly built appearance (null = back to default)
    applyUser: function (next) { user = next; applyUser(); apply(); },
  };
})();
