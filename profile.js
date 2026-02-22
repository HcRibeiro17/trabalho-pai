let currentUser = null;
let myOrdersPage = 1;
const myOrdersPageSize = 8;
let myOrdersTotalRows = 0;
let currentAvatarUrl = "";

function setFeedback(message, isError) {
  const feedback = document.getElementById("profileFeedback");
  feedback.textContent = message || "";
  feedback.classList.toggle("error", Boolean(isError));
}

function setOrdersFeedback(message, isError) {
  const feedback = document.getElementById("myOrdersFeedback");
  feedback.textContent = message || "";
  feedback.classList.toggle("error", Boolean(isError));
}

function moneyBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function currencyHtml(value) {
  const numeric = Number(value || 0);
  const formatted = moneyBRL(numeric);
  if (numeric < 0) {
    return `<span class="currency-negative">${formatted}</span>`;
  }
  return formatted;
}

function formatDateTimeBR(isoDate) {
  return new Date(isoDate).toLocaleString("pt-BR");
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
    .select("display_name, role, regional, avatar_url")
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
  currentAvatarUrl = data?.avatar_url || "";
  renderAvatarPreview();
}

function renderAvatarPreview() {
  const img = document.getElementById("profileAvatarPreview");
  if (currentAvatarUrl) {
    img.src = currentAvatarUrl;
    return;
  }

  img.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='100%' height='100%' fill='%23f3f4f6'/><circle cx='64' cy='48' r='24' fill='%239ca3af'/><rect x='28' y='82' width='72' height='28' rx='14' fill='%239ca3af'/></svg>";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo da foto."));
    reader.readAsDataURL(file);
  });
}

async function handleAvatarFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setFeedback("Selecione um arquivo de imagem valido.", true);
    event.target.value = "";
    return;
  }

  if (file.size > 1024 * 1024) {
    setFeedback("A foto deve ter no maximo 1MB.", true);
    event.target.value = "";
    return;
  }

  try {
    currentAvatarUrl = await readFileAsDataUrl(file);
    renderAvatarPreview();
    setFeedback("", false);
  } catch (error) {
    console.error("Erro ao processar foto de perfil:", error);
    setFeedback("Nao foi possivel processar a foto.", true);
  }
}

function renderMyOrdersTable(rows) {
  const tableBody = document.getElementById("myOrdersTableBody");
  tableBody.innerHTML = "";

  if (!rows || rows.length === 0) {
    tableBody.innerHTML = "<tr><td colspan='5' class='empty-cell'>Nenhum pedido encontrado.</td></tr>";
    return;
  }

  rows.forEach((order) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${order.order_code || "-"}</td>
      <td>${order.clients?.name || "-"}</td>
      <td>${currencyHtml(order.total)}</td>
      <td>${order.status || "-"}</td>
      <td>${formatDateTimeBR(order.created_at)}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function updateMyOrdersPaginationControls() {
  const totalPages = Math.max(1, Math.ceil(myOrdersTotalRows / myOrdersPageSize));
  document.getElementById("myOrdersPaginationInfo").textContent = `Pagina ${myOrdersPage} de ${totalPages} (${myOrdersTotalRows} itens)`;
  document.getElementById("myOrdersPrevPageButton").disabled = myOrdersPage <= 1;
  document.getElementById("myOrdersNextPageButton").disabled = myOrdersPage >= totalPages;
}

async function loadMyOrders() {
  const supabase = window.supabaseClient;
  const from = (myOrdersPage - 1) * myOrdersPageSize;
  const to = from + myOrdersPageSize - 1;

  const { data, error, count } = await supabase
    .from("orders")
    .select("order_code, total, status, created_at, clients(name)", { count: "exact" })
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Erro ao listar meus pedidos:", error);
    setOrdersFeedback("Nao foi possivel carregar seus pedidos.", true);
    return;
  }

  setOrdersFeedback("", false);
  myOrdersTotalRows = count || 0;
  renderMyOrdersTable(data || []);
  updateMyOrdersPaginationControls();
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
    avatar_url: currentAvatarUrl || null,
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
  document.getElementById("profileAvatarFile").addEventListener("change", handleAvatarFileChange);
  document.getElementById("myOrdersPrevPageButton").addEventListener("click", () => {
    if (myOrdersPage <= 1) return;
    myOrdersPage -= 1;
    loadMyOrders();
  });
  document.getElementById("myOrdersNextPageButton").addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(myOrdersTotalRows / myOrdersPageSize));
    if (myOrdersPage >= totalPages) return;
    myOrdersPage += 1;
    loadMyOrders();
  });

  await loadProfile();
  await loadMyOrders();
}

document.addEventListener("DOMContentLoaded", initProfilePage);
