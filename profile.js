let currentUser = null;

function setFeedback(message, isError) {
  const feedback = document.getElementById("profileFeedback");
  feedback.textContent = message || "";
  feedback.classList.toggle("error", Boolean(isError));
}

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
  document.getElementById("profileEmail").value = currentUser.email || "";

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, role, regional")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar perfil:", error);
    setFeedback("Erro ao carregar perfil.", true);
    return;
  }

  document.getElementById("profileName").value = data?.display_name || "";
  document.getElementById("profileRole").value = data?.role || "";
  document.getElementById("profileRegional").value = data?.regional || "";
}

async function saveProfile() {
  const supabase = window.supabaseClient;
  const name = document.getElementById("profileName").value.trim();
  const role = document.getElementById("profileRole").value;
  const regional = document.getElementById("profileRegional").value;

  setFeedback("", false);

  if (!name || !role || !regional) {
    setFeedback("Preencha login, cargo e regional.", true);
    return;
  }

  const { data: existingName, error: nameError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("display_name", name)
    .neq("user_id", currentUser.id)
    .limit(1);

  if (nameError) {
    console.error("Erro ao validar login:", nameError);
    setFeedback("Erro ao validar login na base.", true);
    return;
  }

  if (existingName && existingName.length > 0) {
    setFeedback("Esse login ja esta em uso. Escolha outro.", true);
    return;
  }

  const payload = {
    user_id: currentUser.id,
    display_name: name,
    role,
    regional,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("profiles").upsert(payload, {
    onConflict: "user_id",
  });

  if (error) {
    console.error("Erro ao salvar perfil:", error);
    setFeedback("Nao foi possivel salvar perfil.", true);
    return;
  }

  setFeedback("Perfil atualizado com sucesso.", false);
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

async function initProfilePage() {
  currentUser = await getSessionUser();
  if (!currentUser) return;

  document.getElementById("saveProfileButton").addEventListener("click", saveProfile);
  document.getElementById("logoutButton").addEventListener("click", logout);
  await loadProfile();
}

document.addEventListener("DOMContentLoaded", initProfilePage);
