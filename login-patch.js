document.addEventListener("DOMContentLoaded",()=>{
const btn=document.getElementById("loginBtn");
const email=document.getElementById("loginEmail");
if(btn){
 btn.onclick=()=>Auth.login(email.value);
}
});