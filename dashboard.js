let currentUser = null;

async function getSessionUser() {
  const supabase = window.supabaseClient;
  if (!supabase) {
    alert("Falha ao inicializar o Supabase. Recarregue a pagina.");
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    window.location.href = "index.html";
    return null;
  }

  return data.user;
}

async function loadProfile() {
  const supabase = window.supabaseClient;

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, role, regional")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar perfil:", error);
    alert("Nao foi possivel carregar perfil.");
    return null;
  }

  if (!data) {
    window.location.href = "profile.html";
    return null;
  }

  document.getElementById("welcomeName").textContent = `Bem-vindo, ${data.display_name}`;
  document.getElementById("welcomeMeta").textContent = `${data.role} | ${data.regional}`;
  return data;
}

async function logout() {
  const supabase = window.supabaseClient;
  if (!supabase) {
    window.location.href = "index.html";
    return;
  }

  await supabase.auth.signOut();
  window.location.href = "index.html";
}

async function initDashboard() {
  currentUser = await getSessionUser();
  if (!currentUser) return;

  await loadProfile();
  document.getElementById("logoutButton").addEventListener("click", logout);
}

document.addEventListener("DOMContentLoaded", initDashboard);
