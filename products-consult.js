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

function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "-";
  return numeric.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function computeBaseMargin(product) {
  const priceTable = Number(product.price_table || 0);
  const priceTableZero = Number(product.price_margin_zero || 0);
  const variableValue = Number(product.variable_value || 0);
  const denominator = priceTable - priceTableZero;
  if (denominator === 0) return null;
  return variableValue / denominator;
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

function renderProductsTable(rows) {
  const tableBody = document.getElementById("productsTableBody");
  tableBody.innerHTML = "";

  if (!rows || rows.length === 0) {
    tableBody.innerHTML = "<tr><td colspan='8' class='empty-cell'>Nenhum produto encontrado.</td></tr>";
    return;
  }

  rows.forEach((product) => {
    const weight = product.weight ?? product.test_value;
    const margin = computeBaseMargin(product);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${product.product_code}</td>
      <td>${product.name}</td>
      <td>${formatBRL(product.price_table)}</td>
      <td>${formatBRL(product.price_margin_zero)}</td>
      <td>${formatNumber(weight)}</td>
      <td>${formatNumber(product.variable_value)}</td>
      <td>${margin === null ? "-" : formatNumber(margin)}</td>
      <td>
        <button type="button" class="remove-item remove-icon-btn" data-id="${product.id}" aria-label="Excluir produto">
          <span aria-hidden="true">-</span>
        </button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

async function deleteProduct(productId) {
  const supabase = window.supabaseClient;
  const confirmed = window.confirm("Deseja realmente excluir este produto?");
  if (!confirmed) return;

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("user_id", currentUser.id);

  if (error) {
    console.error("Erro ao excluir produto:", error);
    setFeedback("Nao foi possivel excluir o produto.", true);
    return;
  }

  setFeedback("Produto excluido com sucesso.", false);
  await loadProducts();
}

function updatePaginationControls() {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  document.getElementById("paginationInfo").textContent = `Pagina ${currentPage} de ${totalPages} (${totalRows} itens)`;
  document.getElementById("prevPageButton").disabled = currentPage <= 1;
  document.getElementById("nextPageButton").disabled = currentPage >= totalPages;
}

async function loadProducts() {
  const supabase = window.supabaseClient;
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("products")
    .select("*", { count: "exact" });

  if (currentSearch) {
    query = query.or(`product_code.ilike.%${currentSearch}%,name.ilike.%${currentSearch}%`);
  }

  const { data, error, count } = await query
    .order("name", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("Erro ao listar produtos:", error);
    setFeedback("Nao foi possivel listar os produtos.", true);
    return;
  }

  totalRows = count || 0;
  renderProductsTable(data || []);
  updatePaginationControls();
}

function applySearch() {
  currentSearch = document.getElementById("productSearchInput").value.trim();
  currentPage = 1;
  loadProducts();
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

async function initProductsConsultPage() {
  currentUser = await getSessionUser();
  if (!currentUser) return;

  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("productSearchButton").addEventListener("click", applySearch);
  document.getElementById("productSearchInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      applySearch();
    }
  });
  document.getElementById("prevPageButton").addEventListener("click", () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    loadProducts();
  });
  document.getElementById("nextPageButton").addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    if (currentPage >= totalPages) return;
    currentPage += 1;
    loadProducts();
  });

  document.getElementById("productsTableBody").addEventListener("click", (event) => {
    const removeButton = event.target.closest(".remove-item");
    if (!removeButton) return;
    const productId = removeButton.getAttribute("data-id");
    if (!productId) return;
    deleteProduct(productId);
  });

  await loadProducts();
}

document.addEventListener("DOMContentLoaded", initProductsConsultPage);
