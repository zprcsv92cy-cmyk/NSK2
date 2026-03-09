(function(){
  function wireLogin(){
    var btn = document.getElementById("loginBtn") || document.getElementById("btnSendLink");
    var input = document.getElementById("email") || document.getElementById("loginEmail");

    function doLogin(){
      var email = (input ? input.value : "").trim();
      if(!email) return;
      if(window.Auth && Auth.login) Auth.login(email).catch(console.error);
    }

    if(btn) btn.addEventListener("click", doLogin);

    if(input){
      input.addEventListener("keydown", function(e){
        if(e.key === "Enter"){
          e.preventDefault();
          doLogin();
        }
      });
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", wireLogin);
  } else {
    wireLogin();
  }
})();
