// app.js patch — Lagväljare V1
(function(){
  if (!window.NSK2App) return;

  function initTeamSelector(){
    const buttons = Array.from(document.querySelectorAll(".teamBtn"));
    const active = document.getElementById("activeTeam");
    if (!buttons.length || !active) return;

    let team = localStorage.getItem("nsk_active_team") || "1";

    function setActive(t){
      buttons.forEach(b => b.classList.remove("active"));
      const btn = document.querySelector('.teamBtn[data-team="' + t + '"]');
      if (btn) btn.classList.add("active");
      active.innerHTML = `Aktivt lag: <strong>Lag ${t}</strong>`;
    }

    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        team = btn.dataset.team || "1";
        localStorage.setItem("nsk_active_team", team);
        setActive(team);
      });
    });

    setActive(team);
  }

  const oldInit = window.NSK2App.init;

  window.NSK2App.init = async function(){
    if (oldInit) await oldInit();
    initTeamSelector();
  };
})();
