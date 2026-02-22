let currentUser = null;
let currentPage = 1;
const pageSize = 10;
let totalRows = 0;
let filters = {
  search: "",
  status: "",
  regional: "",
  dateFrom: "",
  dateTo: "",
};
let currentPreviewBlobUrl = null;

const pdfPreviewModal = document.getElementById("pdfPreviewModal");
const pdfPreviewFrame = document.getElementById("pdfPreviewFrame");
const closePdfPreviewButton = document.getElementById("closePdfPreviewButton");

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

function getStatusLabel(status) {
  if (status === "aberto") return "Em criacao";
  if (status === "em_criacao") return "Em criacao";
  if (status === "finalizado") return "Finalizado";
  if (status === "cancelado") return "Cancelado";
  return status || "-";
}

function statusChipHtml(status) {
  const statusClass = status === "aberto" ? "em_criacao" : (status || "unknown");
  const className = `status-chip status-${statusClass}`;
  return `<span class="${className}">${getStatusLabel(status)}</span>`;
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

function closePdfPreview() {
  if (currentPreviewBlobUrl) {
    URL.revokeObjectURL(currentPreviewBlobUrl);
    currentPreviewBlobUrl = null;
  }

  pdfPreviewFrame.removeAttribute("src");
  pdfPreviewModal.classList.add("hidden");
  pdfPreviewModal.setAttribute("aria-hidden", "true");
}

function openPdfPreview(blob) {
  if (currentPreviewBlobUrl) {
    URL.revokeObjectURL(currentPreviewBlobUrl);
  }

  currentPreviewBlobUrl = URL.createObjectURL(blob);
  pdfPreviewFrame.src = currentPreviewBlobUrl;
  pdfPreviewModal.classList.remove("hidden");
  pdfPreviewModal.setAttribute("aria-hidden", "false");
}

function previewOrderPdf(order, items) {
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
  y += 5;
  pdf.text(`Status: ${getStatusLabel(order.status)}`, 14, y);
  y += 8;

  pdf.text("Produto", 14, y);
  pdf.text("Qtd", 95, y);
  pdf.text("Peso Tot. (kg)", 112, y);
  pdf.text("Vlr Tot.", 138, y);
  pdf.text("Margem (R$/kg)", 164, y);
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
  const totalMarginPerKg = totals.totalWeight > 0 ? totals.totalMarginTon / totals.totalWeight : 0;
  pdf.text(`Peso Total (kg): ${numberBR(totals.totalWeight)}`, 14, y);
  y += 5;
  pdf.text(`Valor Total: ${moneyBRL(totals.totalValue)}`, 14, y);
  y += 5;
  pdf.text(`Margem Total (R$/kg): ${moneyBRL(totalMarginPerKg)}`, 14, y);
  y += 5;
  pdf.text(`Margem Total (T): ${moneyBRL(totals.totalMarginTon)}`, 14, y);

  const pdfBlob = pdf.output("blob");
  openPdfPreview(pdfBlob);
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

function renderOrderActions(order) {
  const editable = order.status === "em_criacao" || order.status === "aberto";
  const cancellable = editable || order.status === "finalizado";
  const editDisabled = !editable ? "disabled" : "";
  const finalizeDisabled = !editable ? "disabled" : "";
  const cancelDisabled = !cancellable ? "disabled" : "";

  return `
    <div class="order-actions">
      <button type="button" class="icon-btn" data-action="edit" data-order-id="${order.id}" title="Editar pedido" aria-label="Editar pedido" ${editDisabled}>&#9998;</button>
      <button type="button" class="icon-btn" data-action="finalize" data-order-id="${order.id}" title="Finalizar pedido" aria-label="Finalizar pedido" ${finalizeDisabled}>&#10003;</button>
      <button type="button" class="icon-btn danger" data-action="cancel" data-order-id="${order.id}" title="Cancelar pedido" aria-label="Cancelar pedido" ${cancelDisabled}>&#10005;</button>
      <button type="button" class="icon-btn" data-action="pdf" data-order-id="${order.id}" title="Pre-visualizar PDF" aria-label="Pre-visualizar PDF">&#128065;</button>
    </div>
  `;
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
      <td>${statusChipHtml(order.status)}</td>
      <td>${formatDateTimeBR(order.created_at)}</td>
      <td>${renderOrderActions(order)}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function applyFiltersToQuery(query) {
  let updatedQuery = query;

  if (filters.search) {
    updatedQuery = updatedQuery.ilike("order_code", `%${filters.search}%`);
  }

  if (filters.status) {
    if (filters.status === "em_criacao") {
      updatedQuery = updatedQuery.in("status", ["em_criacao", "aberto"]);
    } else {
      updatedQuery = updatedQuery.eq("status", filters.status);
    }
  }

  if (filters.regional) {
    updatedQuery = updatedQuery.eq("regional", filters.regional);
  }

  if (filters.dateFrom) {
    updatedQuery = updatedQuery.gte("created_at", `${filters.dateFrom}T00:00:00`);
  }

  if (filters.dateTo) {
    updatedQuery = updatedQuery.lte("created_at", `${filters.dateTo}T23:59:59`);
  }

  return updatedQuery;
}

async function loadOrders() {
  const supabase = window.supabaseClient;
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("orders")
    .select("id, order_code, regional, total, status, created_at, clients(name)", { count: "exact" })
    .eq("user_id", currentUser.id);

  query = applyFiltersToQuery(query);

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

  previewOrderPdf(
    {
      ...order,
      client_name: order.clients?.name || "-",
    },
    items || []
  );
}

async function updateOrderStatus(orderId, targetStatus) {
  const supabase = window.supabaseClient;
  const message = targetStatus === "finalizado"
    ? "Deseja realmente finalizar este pedido?"
    : "Deseja realmente cancelar este pedido?";

  if (!window.confirm(message)) return;

  if (targetStatus === "finalizado") {
    const { count, error: countError } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId);

    if (countError) {
      console.error("Erro ao validar itens do pedido:", countError);
      setFeedback("Nao foi possivel validar os itens do pedido.", true);
      return;
    }

    if (!count || count <= 0) {
      setFeedback("Nao e possivel finalizar pedido sem itens.", true);
      return;
    }
  }

  const allowedCurrentStatuses = targetStatus === "cancelado"
    ? ["em_criacao", "aberto", "finalizado"]
    : ["em_criacao", "aberto"];

  const { data, error } = await supabase
    .from("orders")
    .update({ status: targetStatus })
    .eq("id", orderId)
    .eq("user_id", currentUser.id)
    .in("status", allowedCurrentStatuses)
    .select("id");

  if (error) {
    console.error("Erro ao atualizar status do pedido:", error);
    setFeedback("Nao foi possivel atualizar o status do pedido.", true);
    return;
  }

  if (!data || data.length === 0) {
    setFeedback("Pedido nao esta em um status permitido para essa acao.", true);
    await loadOrders();
    return;
  }

  setFeedback(`Pedido ${targetStatus === "finalizado" ? "finalizado" : "cancelado"} com sucesso.`, false);
  await loadOrders();
}

function applySearch() {
  filters = {
    search: document.getElementById("orderSearchInput").value.trim(),
    status: document.getElementById("orderStatusFilter").value,
    regional: document.getElementById("orderRegionalFilter").value,
    dateFrom: document.getElementById("orderDateFromFilter").value,
    dateTo: document.getElementById("orderDateToFilter").value,
  };
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

  ["orderStatusFilter", "orderRegionalFilter", "orderDateFromFilter", "orderDateToFilter"].forEach((id) => {
    document.getElementById(id).addEventListener("change", applySearch);
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

  document.getElementById("ordersTableBody").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-order-id][data-action]");
    if (!button) return;

    const orderId = button.getAttribute("data-order-id");
    const action = button.getAttribute("data-action");
    if (!orderId || !action) return;

    if (action === "pdf") {
      await generatePdfByOrderId(orderId);
      return;
    }

    if (action === "edit") {
      window.location.href = `new-order.html?orderId=${encodeURIComponent(orderId)}`;
      return;
    }

    if (action === "finalize") {
      await updateOrderStatus(orderId, "finalizado");
      return;
    }

    if (action === "cancel") {
      await updateOrderStatus(orderId, "cancelado");
    }
  });

  closePdfPreviewButton.addEventListener("click", closePdfPreview);

  pdfPreviewModal.addEventListener("click", (event) => {
    if (event.target === pdfPreviewModal) {
      closePdfPreview();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !pdfPreviewModal.classList.contains("hidden")) {
      closePdfPreview();
    }
  });

  await loadOrders();
}

document.addEventListener("DOMContentLoaded", initOrdersConsultPage);

