/* NSK V10 safe patch */
(function () {
  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("../sw.js").catch(() => {});
    });
  }

  function addVersionBadge() {
    const target = document.getElementById("appError");
    if (!target || !window.APP_CONFIG?.APP_VERSION) return;
    if (!target.textContent) {
      target.textContent = "Version: " + window.APP_CONFIG.APP_VERSION;
    }
  }

  function hardReloadIfOldPath() {
    if (location.pathname.includes("//")) {
      location.replace(location.pathname.replace(/\/+/g, "/"));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    registerSW();
    addVersionBadge();
    hardReloadIfOldPath();
  });
})();
