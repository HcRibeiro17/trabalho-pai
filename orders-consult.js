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

function numberBR(value, fractionDigits = 2) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatDateTimeBR(isoDate) {
  return new Date(isoDate).toLocaleString("pt-BR");
}

function getItemMargin(item) {
  const product = item.products || {};
  const priceTable = Number(product.price_table || 0);
  const marginZeroPrice = Number(product.price_margin_zero || 0);
  const variableValue = Number(product.variable_value || 0);
  const negotiatedPrice = Number(item.unit_price || 0);
  const denominator = priceTable - marginZeroPrice;

  if (denominator === 0) return null;
  const baseMargin = variableValue / denominator;
  return (negotiatedPrice - marginZeroPrice) * baseMargin;
}

function downloadOrderPdf(order, items) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    setFeedback("Biblioteca de PDF nao carregou.", true);
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = 14;

  const totals = items.reduce((acc, item) => {
    const product = item.products || {};
    const quantity = Number(item.quantity || 0);
    const weight = Number(product.weight || 0);
    const totalWeight = quantity * weight;
    const totalValue = quantity * Number(item.unit_price || 0);
    const margin = getItemMargin(item);
    const totalMarginTon = margin === null || Number.isNaN(margin) ? 0 : margin * (totalWeight / 1000);

    acc.totalWeight += totalWeight;
    acc.totalValue += totalValue;
    acc.totalMargin += margin === null || Number.isNaN(margin) ? 0 : margin;
    acc.totalMarginTon += totalMarginTon;
    return acc;
  }, { totalWeight: 0, totalValue: 0, totalMargin: 0, totalMarginTon: 0 });

  pdf.setFontSize(14);
  pdf.text("Monta Pedidos - Pedido", 14, y);
  y += 8;

  pdf.setFontSize(10);
  pdf.text(`Pedido: ${order.order_code}`, 14, y);
  y += 5;
  pdf.text(`Regional: ${order.regional}`, 14, y);
  y += 5;
  pdf.text(`Cliente: ${order.client_name || "-"}`, 14, y);
  y += 5;
  pdf.text(`Data: ${formatDateTimeBR(order.created_at)}`, 14, y);
  y += 8;

  pdf.text("Produto", 14, y);
  pdf.text("Qtd", 95, y);
  pdf.text("Peso Tot.", 112, y);
  pdf.text("Vlr Tot.", 138, y);
  pdf.text("Margem", 164, y);
  pdf.text("Margem T", 186, y);
  y += 2;
  pdf.line(14, y, 196, y);
  y += 5;

  items.forEach((item) => {
    const product = item.products || {};
    const label = `${product.product_code || ""} - ${product.name || ""}`.slice(0, 42);
    const quantity = Number(item.quantity || 0);
    const totalWeight = quantity * Number(product.weight || 0);
    const totalValue = quantity * Number(item.unit_price || 0);
    const margin = getItemMargin(item);
    const marginTon = margin === null || Number.isNaN(margin) ? 0 : margin * (totalWeight / 1000);

    if (y > 276) {
      pdf.addPage();
      y = 14;
    }

    pdf.text(label, 14, y);
    pdf.text(String(quantity), 95, y, { align: "right" });
    pdf.text(numberBR(totalWeight), 126, y, { align: "right" });
    pdf.text(moneyBRL(totalValue), 158, y, { align: "right" });
    pdf.text(margin === null || Number.isNaN(margin) ? "-" : moneyBRL(margin), 180, y, { align: "right" });
    pdf.text(moneyBRL(marginTon), 196, y, { align: "right" });
    y += 5;
  });

  y += 4;
  pdf.line(14, y, 196, y);
  y += 6;
  pdf.text(`Peso Total: ${numberBR(totals.totalWeight)}`, 14, y);
  y += 5;
  pdf.text(`Valor Total: ${moneyBRL(totals.totalValue)}`, 14, y);
  y += 5;
  pdf.text(`Margem Total: ${moneyBRL(totals.totalMargin)}`, 14, y);
  y += 5;
  pdf.text(`Margem Total (T): ${moneyBRL(totals.totalMarginTon)}`, 14, y);

  pdf.save(`${order.order_code}.pdf`);
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

function updatePaginationControls() {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  document.getElementById("paginationInfo").textContent = `Pagina ${currentPage} de ${totalPages} (${totalRows} itens)`;
  document.getElementById("prevPageButton").disabled = currentPage <= 1;
  document.getElementById("nextPageButton").disabled = currentPage >= totalPages;
}

function renderOrdersTable(rows) {
  const tableBody = document.getElementById("ordersTableBody");
  tableBody.innerHTML = "";

  if (!rows || rows.length === 0) {
    tableBody.innerHTML = "<tr><td colspan='7' class='empty-cell'>Nenhum pedido encontrado.</td></tr>";
    return;
  }

  rows.forEach((order) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${order.order_code || "-"}</td>
      <td>${order.regional || "-"}</td>
      <td>${order.client_name || "-"}</td>
      <td>${currencyHtml(order.total)}</td>
      <td>${order.status || "-"}</td>
      <td>${formatDateTimeBR(order.created_at)}</td>
      <td>
        <button type="button" class="small-btn" data-order-id="${order.id}">PDF</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

async function loadOrders() {
  const supabase = window.supabaseClient;
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("orders")
    .select("id, order_code, regional, total, status, created_at, clients(name)", { count: "exact" })
    .eq("user_id", currentUser.id);

  if (currentSearch) {
    query = query.ilike("order_code", `%${currentSearch}%`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Erro ao listar pedidos:", error);
    setFeedback("Nao foi possivel listar os pedidos.", true);
    return;
  }

  const rows = (data || []).map((order) => ({
    ...order,
    client_name: order.clients?.name || "-",
  }));

  totalRows = count || 0;
  renderOrdersTable(rows);
  updatePaginationControls();
}

async function generatePdfByOrderId(orderId) {
  const supabase = window.supabaseClient;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_code, regional, total, status, created_at, clients(name)")
    .eq("id", orderId)
    .eq("user_id", currentUser.id)
    .single();

  if (orderError || !order) {
    console.error("Erro ao carregar pedido:", orderError);
    setFeedback("Nao foi possivel gerar PDF do pedido.", true);
    return;
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("quantity, unit_price, products(product_code, name, weight, price_table, price_margin_zero, variable_value)")
    .eq("order_id", orderId);

  if (itemsError) {
    console.error("Erro ao carregar itens do pedido:", itemsError);
    setFeedback("Nao foi possivel gerar PDF do pedido.", true);
    return;
  }

  downloadOrderPdf(
    {
      ...order,
      client_name: order.clients?.name || "-",
    },
    items || []
  );
}

function applySearch() {
  currentSearch = document.getElementById("orderSearchInput").value.trim();
  currentPage = 1;
  loadOrders();
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

async function initOrdersConsultPage() {
  currentUser = await getSessionUser();
  if (!currentUser) return;

  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("orderSearchButton").addEventListener("click", applySearch);
  document.getElementById("orderSearchInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      applySearch();
    }
  });

  document.getElementById("prevPageButton").addEventListener("click", () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    loadOrders();
  });

  document.getElementById("nextPageButton").addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    if (currentPage >= totalPages) return;
    currentPage += 1;
    loadOrders();
  });

  document.getElementById("ordersTableBody").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-order-id]");
    if (!button) return;
    const orderId = button.getAttribute("data-order-id");
    if (!orderId) return;
    generatePdfByOrderId(orderId);
  });

  await loadOrders();
}

document.addEventListener("DOMContentLoaded", initOrdersConsultPage);
