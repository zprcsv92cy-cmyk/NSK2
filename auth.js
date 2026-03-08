window.Auth=(()=>{
let client=null;
function getClient(){
 if(client) return client;
 client=supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_KEY);
 return client;
}
async function login(email){
 const c=getClient();
 await c.auth.signInWithOtp({email});
}
return{login,getClient};
})();