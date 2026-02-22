async function checkUser() {
  const supabase = window.supabaseClient;

  if (!supabase) {
    window.location.href = "index.html";
    return;
  }

  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;

  if (error || !user) {
    window.location.href = "index.html";
    return;
  }

  const userEmail = document.getElementById("userEmail");
  if (userEmail) {
    userEmail.innerText = `Voce esta logado como: ${user.email}`;
  }
}

checkUser();

async function logout() {
  const supabase = window.supabaseClient;
  if (!supabase) {
    window.location.href = "index.html";
    return;
  }

  await supabase.auth.signOut();
  window.location.href = "index.html";
}
