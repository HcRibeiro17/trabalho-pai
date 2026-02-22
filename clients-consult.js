let currentUser = null;
let currentPage = 1;
const pageSize = 10;
let totalRows = 0;
let currentSearch = "";

function setFeedback(message, isError) {
  const feedback = document.getElementById("consultFeedback");
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

function renderClientsTable(rows) {
  const tableBody = document.getElementById("clientsTableBody");
  tableBody.innerHTML = "";

  if (!rows || rows.length === 0) {
    tableBody.innerHTML = "<tr><td colspan='7' class='empty-cell'>Nenhum cliente encontrado.</td></tr>";
    return;
  }

  rows.forEach((client) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${client.name}</td>
      <td>${client.email || "-"}</td>
      <td>${client.phone || "-"}</td>
      <td>${client.payment_term || "-"}</td>
      <td>${client.price_table || "-"}</td>
      <td>${client.billing_unit || "-"}</td>
      <td>
        <button type="button" class="remove-item remove-icon-btn" data-id="${client.id}" aria-label="Excluir cliente">
          <span aria-hidden="true">-</span>
        </button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function updatePaginationControls() {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  document.getElementById("paginationInfo").textContent = `Pagina ${currentPage} de ${totalPages} (${totalRows} itens)`;
  document.getElementById("prevPageButton").disabled = currentPage <= 1;
  document.getElementById("nextPageButton").disabled = currentPage >= totalPages;
}

async function loadClients() {
  const supabase = window.supabaseClient;
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("clients")
    .select("id, name, email, phone, payment_term, price_table, billing_unit", { count: "exact" })
    .eq("user_id", currentUser.id);

  if (currentSearch) {
    query = query.or(`name.ilike.%${currentSearch}%,email.ilike.%${currentSearch}%,phone.ilike.%${currentSearch}%`);
  }

  const { data, error, count } = await query
    .order("name", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("Erro ao listar clientes:", error);
    setFeedback("Nao foi possivel listar os clientes.", true);
    return;
  }

  totalRows = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  if (currentPage > totalPages) {
    currentPage = totalPages;
    await loadClients();
    return;
  }

  renderClientsTable(data || []);
  updatePaginationControls();
}

function applySearch() {
  currentSearch = document.getElementById("clientSearchInput").value.trim();
  currentPage = 1;
  loadClients();
}

async function deleteClient(clientId) {
  const supabase = window.supabaseClient;
  const confirmed = window.confirm("Deseja realmente excluir este cliente?");
  if (!confirmed) return;

  const { data, error } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("user_id", currentUser.id)
    .select("id");

  if (error) {
    console.error("Erro ao excluir cliente:", error);
    if (error.code === "23503") {
      setFeedback("Nao e possivel excluir cliente com pedidos vinculados.", true);
      return;
    }

    setFeedback("Nao foi possivel excluir o cliente.", true);
    return;
  }

  if (!data || data.length === 0) {
    setFeedback("Cliente nao encontrado ou sem permissao para excluir.", true);
    return;
  }

  setFeedback("Cliente excluido com sucesso.", false);
  await loadClients();
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

async function initClientsConsultPage() {
  currentUser = await getSessionUser();
  if (!currentUser) return;

  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("clientSearchButton").addEventListener("click", applySearch);
  document.getElementById("clientSearchInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      applySearch();
    }
  });
  document.getElementById("prevPageButton").addEventListener("click", () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    loadClients();
  });
  document.getElementById("nextPageButton").addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    if (currentPage >= totalPages) return;
    currentPage += 1;
    loadClients();
  });

  document.getElementById("clientsTableBody").addEventListener("click", (event) => {
    const removeButton = event.target.closest(".remove-item");
    if (!removeButton) return;
    const clientId = removeButton.getAttribute("data-id");
    if (!clientId) return;
    deleteClient(clientId);
  });

  await loadClients();
}

document.addEventListener("DOMContentLoaded", initClientsConsultPage);
