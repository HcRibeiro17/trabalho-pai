let currentUser = null;
let myOrdersPage = 1;
const myOrdersPageSize = 8;
let myOrdersTotalRows = 0;

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
      <td>${moneyBRL(order.total)}</td>
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
