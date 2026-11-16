// Runs before first paint (loaded synchronously in <head>, CSP-safe: same origin).
// The app is dark-only (noir theme): always sets .dark, and injects the user's cached accent / text
// size CSS ("diary-appearance": { css }) built by client/src/appearance.js, so nothing flashes.
(function () {
  var USER = "diary-appearance";
  var user = null;
  document.documentElement.classList.add("dark");

  function readUser() {
    try { user = JSON.parse(localStorage.getItem(USER) || "null"); } catch (e) { user = null; }
  }
  function applyUser() {
    var el = document.getElementById("user-theme");
    // v2 = noir; older caches hold retro-desk presets and are ignored
    var css = user && user.v === 2 && typeof user.css === "string" ? user.css : "";
    if (!css) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("style");
      el.id = "user-theme";
      document.head.appendChild(el);
    }
    if (el.textContent !== css) el.textContent = css;
  }
  readUser();
  applyUser();
  window.addEventListener("storage", function () { readUser(); applyUser(); }); // other tabs
  window.diaryTheme = {
    // called by the app with the freshly built appearance (null = back to default)
    applyUser: function (next) { user = next; applyUser(); },
  };
})();
