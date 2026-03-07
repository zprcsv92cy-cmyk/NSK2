(function(){
  function wireLogin(){
    var btn = document.getElementById("loginBtn") || document.getElementById("btnSendLink");
    var input = document.getElementById("email") || document.getElementById("loginEmail");
    var refresh = document.getElementById("btnRefreshSession");

    if(btn && !btn.__v71bound){
      btn.__v71bound = true;
      btn.addEventListener("click", function(){
        if(window.Auth && Auth.login) Auth.login(input ? input.value : "");
      });
    }

    if(input && !input.__v71bound){
      input.__v71bound = true;
      input.setAttribute("type", "email");
      input.setAttribute("autocomplete", "email");
      if(!input.getAttribute("placeholder")) input.setAttribute("placeholder", "namn@exempel.se");
      input.addEventListener("keydown", function(e){
        if(e.key === "Enter"){
          e.preventDefault();
          if(window.Auth && Auth.login) Auth.login(input.value || "");
        }
      });
    }

    if(refresh && !refresh.__v71bound){
      refresh.__v71bound = true;
      refresh.addEventListener("click", function(){
        if(window.Auth && Auth.refreshSession) Auth.refreshSession();
      });
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", wireLogin);
  } else {
    wireLogin();
  }

  window.addEventListener("load", wireLogin);
})();
