window.NSK2App = (() => {
  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  }
  function setText(id, text) {
    const el = byId(id);
    if (el) el.textContent = text || "";
  }

  let players = [];
  let coaches = [];
  let truppenRealtime = null;
  let truppenBound = false;
  let startsidaPoolsLoaded = false;

  async function init() {
    if (window.Auth?.init) await Auth.init();
    await initStartsidaPage();
    await initTruppenPage();
    await initGoalieStatsPage();
  }

  async function initStartsidaPage() {
    const savedPoolsList = byId("savedPoolsList");
    if (!savedPoolsList || startsidaPoolsLoaded) return;
    startsidaPoolsLoaded = true;

    try {
      const pools = await DB.listPools();
      savedPoolsList.innerHTML = pools.length
        ? pools.map(p => `
          <article class="pool-item">
            <div class="pool-top">
              <div>
                <div class="pool-title">${esc(p.pool_date || "Utan datum")} • ${esc(p.place || "Utan plats")}</div>
                <div class="pool-meta">${esc(p.title || "Poolspel")}</div>
              </div>
              <div class="status-badge">${esc(p.status || "Aktiv")}</div>
            </div>
          </article>
        `).join("")
        : '<div class="listrow">Inga sparade poolspel ännu.</div>';
    } catch (err) {
      setText("appError", err.message || String(err));
    }
  }

  function rowHtml(item, type) {
    return `
      <div class="swipe-wrap">
        <button class="swipe-delete-btn" data-delete-${type}="${item.id}">Ta bort</button>
        <div class="person-row draggable-row" draggable="true" data-id="${item.id}" data-type="${type}">
          <div class="drag-handle">☰</div>
          <div class="person-main">
            <input class="inline-name-input" value="${esc(item.full_name)}" data-inline-${type}="${item.id}">
          </div>
          <div class="row-actions">
            <button class="row-btn" data-save-${type}="${item.id}">Spara</button>
            <button class="row-btn danger desktop-delete" data-delete-${type}="${item.id}">Ta bort</button>
          </div>
        </div>
      </div>
    `;
  }

  async function renderPlayers() {
    const list = byId("playersList");
    if (!list) return;
    players = await DB.listPlayers();
    list.innerHTML = players.length ? players.map(p => rowHtml(p,