window.DB = (() => {
  const KEY = "nsk_v5_state";

  function defaults() {
    return {
      pools: [],
      invites: []
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : defaults();
      data.pools = Array.isArray(data.pools) ? data.pools : [];
      data.invites = Array.isArray(data.invites) ? data.invites : [];
      return data;
    } catch {
      return defaults();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function savePool(pool) {
    const data = load();
    const idx = data.pools.findIndex(p => p.id === pool.id);
    if (idx >= 0) data.pools[idx] = pool;
    else data.pools.unshift(pool);
    save(data);
    return pool;
  }

  function saveInvite(invite) {
    const data = load();
    const idx = data.invites.findIndex(i => i.email.toLowerCase() === invite.email.toLowerCase());
    if (idx >= 0) data.invites[idx] = invite;
    else data.invites.unshift(invite);
    save(data);
    return invite;
  }

  return { load, save, savePool, saveInvite };
})();
