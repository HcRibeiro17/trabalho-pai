let currentUser = null;
let currentProfile = null;
let clients = [];
let products = [];
let cartItems = [];
let currentOrderClientId = null;
let currentOrderRegional = "";
let currentOrderId = null;
let currentOrderCode = null;
let currentOrderStatus = "em_criacao";
let lockedProfileModal = false;
let cartCurrentPage = 1;
const cartPageSize = 8;

const profileModal = document.getElementById("profileModal");
const welcomeName = document.getElementById("welcomeName");
const welcomeMeta = document.getElementById("welcomeMeta");
const orderTitle = document.getElementById("orderTitle");
const orderStatusInfo = document.getElementById("orderStatusInfo");
const selectedClientInfo = document.getElementById("selectedClientInfo");
const clientSearchInput = document.getElementById("clientSearchInput");
const clientSuggestions = document.getElementById("clientSuggestions");
const productSearchInput = document.getElementById("productSearchInput");
const productSuggestions = document.getElementById("productSuggestions");
const orderRegionalSelect = document.getElementById("orderRegionalSelect");
const saveOrderButton = document.getElementById("saveOrderButton");
const finalizeOrderButton = document.getElementById("finalizeOrderButton");
const cancelOrderButton = document.getElementById("cancelOrderButton");

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
    return `<span class="currency-value currency-negative">${formatted}</span>`;
  }
  return `<span class="currency-value">${formatted}</span>`;
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

function parsePtBrNumber(rawValue) {
  const cleaned = String(rawValue || "")
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  if (cleaned === "") return null;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function getStatusLabel(status) {
  if (status === "aberto") return "em criacao";
  if (status === "em_criacao") return "em criacao";
  if (status === "finalizado") return "finalizado";
  if (status === "cancelado") return "cancelado";
  return status || "-";
}

function isOrderEditable() {
  return currentOrderStatus === "em_criacao" || currentOrderStatus === "aberto";
}

function showProfileModal(locked) {
  lockedProfileModal = locked;
  profileModal.classList.remove("hidden");
}

function hideProfileModal() {
  if (lockedProfileModal) return;
  profileModal.classList.add("hidden");
}

function setProfileFeedback(message, isError) {
  const feedback = document.getElementById("profileFeedback");
  feedback.textContent = message || "";
  feedback.classList.toggle("error", Boolean(isError));
}

function renderWelcome() {
  if (!currentProfile) return;
  welcomeName.textContent = `Bem-vindo, ${currentProfile.display_name}`;
  welcomeMeta.textContent = `${currentProfile.role} | ${currentProfile.regional}`;
}

function getSelectedClient() {
  return clients.find((item) => item.id === currentOrderClientId) || null;
}

function renderSelectedClientCard() {
  const client = getSelectedClient();
  if (!client) {
    selectedClientInfo.classList.add("empty");
    selectedClientInfo.innerHTML = "Selecione um cliente para visualizar os detalhes.";
    return;
  }

  selectedClientInfo.classList.remove("empty");
  selectedClientInfo.innerHTML = `
    <div class="selected-client-head">
      <p class="selected-client-title">${client.name}</p>
      <span class="selected-client-pill">Cliente selecionado</span>
    </div>
    <div class="selected-client-grid">
      <span class="selected-client-item"><strong>Email:</strong> ${client.email || "-"}</span>
      <span class="selected-client-item"><strong>Telefone:</strong> ${client.phone || "-"}</span>
      <span class="selected-client-item"><strong>Prazo:</strong> ${client.payment_term || "-"}</span>
      <span class="selected-client-item"><strong>Tabela:</strong> ${client.price_table || "-"}</span>
      <span class="selected-client-item"><strong>Unidade:</strong> ${client.billing_unit || "-"}</span>
    </div>
  `;
}

function showSuggestions(container, rows) {
  container.innerHTML = "";
  if (!rows || rows.length === 0) {
    container.classList.add("hidden");
    return;
  }

  rows.forEach((row) => container.appendChild(row));
  container.classList.remove("hidden");
}

function hideSuggestions(container) {
  container.innerHTML = "";
  container.classList.add("hidden");
}

function updateOrderHeader() {
  const titleLabel = currentOrderId
    ? `Editar Pedido ${currentOrderCode || ""}`.trim()
    : "Novo Pedido";
  orderTitle.textContent = titleLabel;
  const regionalLabel = currentOrderRegional || "-";
  orderStatusInfo.textContent = `Status: ${getStatusLabel(currentOrderStatus)} | Regional: ${regionalLabel}`;
  cancelOrderButton.classList.toggle("hidden", !currentOrderId || !isOrderEditable());
}

function updateInputLockState() {
  const hasItems = cartItems.length > 0;
  const editable = isOrderEditable();
  clientSearchInput.disabled = !editable || hasItems;
  productSearchInput.disabled = !editable;
  orderRegionalSelect.disabled = !editable || hasItems || Boolean(currentOrderId);
  saveOrderButton.disabled = !editable;
  finalizeOrderButton.disabled = !editable;
  cancelOrderButton.disabled = !editable;
}

function updateClientLockState() {
  renderSelectedClientCard();
  updateInputLockState();
}

function setOrderRegional(regional) {
  if (!isOrderEditable()) return;
  if (cartItems.length > 0 || currentOrderId) {
    orderRegionalSelect.value = currentOrderRegional || "";
    return;
  }

  currentOrderRegional = regional || "";
  orderRegionalSelect.value = currentOrderRegional;
  updateProductInputPlaceholder();
  productSearchInput.value = "";
  hideSuggestions(productSuggestions);
}

function updateProductInputPlaceholder() {
  productSearchInput.placeholder = currentOrderRegional
    ? "Digite para buscar item"
    : "Selecione a regional para buscar itens";
}

function getCartTotal() {
  return cartItems.reduce(
    (sum, item) => sum + Number(item.negotiated_price || 0) * Number(item.quantity || 0),
    0
  );
}

function getCartFormulaTotals() {
  return cartItems.reduce((acc, item) => {
    const quantity = Number(item.quantity || 0);
    const unitWeight = Number(item.unit_weight || 0);
    const negotiatedPrice = Number(item.negotiated_price || 0);
    const itemMargin = getItemMargin(item);
    const totalWeight = quantity * unitWeight;
    const totalValue = quantity * negotiatedPrice;
    const totalMarginTon = itemMargin === null || Number.isNaN(itemMargin)
      ? 0
      : itemMargin * (totalWeight / 1000);

    acc.totalWeight += totalWeight;
    acc.totalValue += totalValue;
    acc.totalMargin += itemMargin === null || Number.isNaN(itemMargin) ? 0 : itemMargin;
    acc.totalMarginTon += totalMarginTon;
    return acc;
  }, {
    totalWeight: 0,
    totalValue: 0,
    totalMargin: 0,
    totalMarginTon: 0,
  });
}

function getItemMargin(item) {
  const tablePrice = Number(item.table_price || 0);
  const marginZeroPrice = Number(item.margin_zero_price || 0);
  const variableValue = Number(item.variable_value || 0);
  const negotiatedPrice = Number(item.negotiated_price || 0);
  const denominator = tablePrice - marginZeroPrice;

  if (denominator === 0) return null;
  const baseMargin = variableValue / denominator;
  return (negotiatedPrice - marginZeroPrice) * baseMargin;
}

function getDisplayedTotalMargin(totals) {
  const totalWeight = Number(totals?.totalWeight || 0);
  const totalMarginTon = Number(totals?.totalMarginTon || 0);
  if (totalWeight <= 0) return 0;
  return totalMarginTon / (totalWeight / 1000);
}

function downloadOrderPdf(orderRow, clientName, itemsSnapshot, totals) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = 14;

  pdf.setFontSize(14);
  pdf.text("Monta Pedidos - Pedido", 14, y);
  y += 8;

  pdf.setFontSize(10);
  pdf.text(`Pedido: ${orderRow.order_code}`, 14, y);
  y += 5;
  pdf.text(`Regional: ${orderRow.regional}`, 14, y);
  y += 5;
  pdf.text(`Cliente: ${clientName || "-"}`, 14, y);
  y += 5;
  pdf.text(`Data: ${formatDateTimeBR(new Date().toISOString())}`, 14, y);
  y += 8;

  pdf.text("Produto", 14, y);
  pdf.text("Qtd", 95, y);
  pdf.text("Peso Tot.", 112, y);
  pdf.text("Vlr Tot.", 138, y);
  pdf.text("Margem", 164, y);
  pdf.text("Margem Total", 186, y);
  y += 2;
  pdf.line(14, y, 196, y);
  y += 5;

  itemsSnapshot.forEach((item) => {
    const totalWeight = Number(item.quantity || 0) * Number(item.unit_weight || 0);
    const totalValue = Number(item.quantity || 0) * Number(item.negotiated_price || 0);
    const margin = getItemMargin(item);
    const marginTon = margin === null || Number.isNaN(margin) ? 0 : margin * (totalWeight / 1000);

    if (y > 276) {
      pdf.addPage();
      y = 14;
    }

    const label = String(item.product_label || "").slice(0, 42);
    pdf.text(label, 14, y);
    pdf.text(String(item.quantity || 0), 95, y, { align: "right" });
    pdf.text(numberBR(totalWeight), 126, y, { align: "right" });
    pdf.text(moneyBRL(totalValue), 158, y, { align: "right" });
    pdf.text(margin === null || Number.isNaN(margin) ? "-" : moneyBRL(margin), 180, y, { align: "right" });
    pdf.text(moneyBRL(marginTon), 196, y, { align: "right" });
    y += 5;
  });

  y += 4;
  pdf.line(14, y, 196, y);
  y += 6;
  const totalMarginPerTon = totals.totalWeight > 0 ? totals.totalMarginTon / (totals.totalWeight / 1000) : 0;
  pdf.text(`Peso Total: ${numberBR(totals.totalWeight)}`, 14, y);
  y += 5;
  pdf.text(`Valor Total: ${moneyBRL(totals.totalValue)}`, 14, y);
  y += 5;
  pdf.text(`Margem por Tonelada: ${moneyBRL(totalMarginPerTon)}`, 14, y);
  y += 5;
  pdf.text(`Margem Total: ${moneyBRL(totals.totalMarginTon)}`, 14, y);

  pdf.save(`${orderRow.order_code}.pdf`);
}

function getRegionalPrefix(regional) {
  if (regional === "ESPIRITO SANTO") return "ES";
  if (regional === "RIO DE JANEIRO") return "RJ";
  return "XX";
}

async function generateNextOrderIdentity() {
  const supabase = window.supabaseClient;
  const regional = currentOrderRegional;

  if (!regional) {
    throw new Error("Regional do pedido nao encontrada.");
  }

  const { data, error } = await supabase
    .from("orders")
    .select("order_seq")
    .eq("user_id", currentUser.id)
    .eq("regional", regional)
    .not("order_seq", "is", null)
    .order("order_seq", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Falha ao gerar sequencial do pedido: ${error.message}`);
  }

  const lastSeq = data && data.length > 0 ? Number(data[0].order_seq || 0) : 0;
  const nextSeq = lastSeq + 1;
  const prefix = getRegionalPrefix(regional);
  const orderCode = `${prefix}-${String(nextSeq).padStart(7, "0")}`;

  return {
    regional,
    orderSeq: nextSeq,
    orderCode,
  };
}

function updateCartPaginationControls() {
  const totalPages = Math.max(1, Math.ceil(cartItems.length / cartPageSize));
  document.getElementById("cartPaginationInfo").textContent = `Pagina ${cartCurrentPage} de ${totalPages} (${cartItems.length} itens)`;
  document.getElementById("cartPrevPageButton").disabled = cartCurrentPage <= 1;
  document.getElementById("cartNextPageButton").disabled = cartCurrentPage >= totalPages;
}

function renderCartTable() {
  const tableBody = document.getElementById("cartTableBody");
  const cartTotalWeight = document.getElementById("cartTotalWeight");
  const cartTotal = document.getElementById("cartTotal");
  const cartTotalMargin = document.getElementById("cartTotalMargin");
  tableBody.innerHTML = "";

  if (cartItems.length === 0) {
    tableBody.innerHTML = "<tr><td colspan='9' class='empty-cell'>Nenhum item no pedido.</td></tr>";
    cartTotalWeight.textContent = "Peso Total: 0,00";
    cartTotal.innerHTML = `Valor Total: ${currencyHtml(0)}`;
    cartTotalMargin.innerHTML = `Margem por Tonelada: ${currencyHtml(0)}`;
    updateClientLockState();
    updateCartPaginationControls();
    return;
  }

  const totalPages = Math.max(1, Math.ceil(cartItems.length / cartPageSize));
  if (cartCurrentPage > totalPages) {
    cartCurrentPage = totalPages;
  }

  const start = (cartCurrentPage - 1) * cartPageSize;
  const end = start + cartPageSize;
  const pageItems = cartItems.slice(start, end);

  pageItems.forEach((item) => {
    const tr = document.createElement("tr");
    const totalWeight = Number(item.quantity) * Number(item.unit_weight || 0);
    const totalValue = Number(item.quantity) * Number(item.negotiated_price || 0);
    const margin = getItemMargin(item);
    const totalMarginTon = margin === null || Number.isNaN(margin)
      ? null
      : margin * (totalWeight / 1000);
    const marginText = margin === null || Number.isNaN(margin)
      ? "-"
      : currencyHtml(margin);
    const totalMarginTonText = totalMarginTon === null || Number.isNaN(totalMarginTon)
      ? "-"
      : currencyHtml(totalMarginTon);
    const disabledAttr = isOrderEditable() ? "" : "disabled";
    tr.innerHTML = `
      <td>${item.product_label}</td>
      <td>${currencyHtml(item.table_price)}</td>
      <td>
        <input
          type="text"
          class="negotiated-input"
          data-item-id="${item.product_id}"
          value="${Number(item.negotiated_price).toFixed(2).replace(".", ",")}"
          ${disabledAttr}
        >
      </td>
      <td>
        <input
          type="number"
          class="quantity-input"
          data-item-id="${item.product_id}"
          min="1"
          step="1"
          value="${Number(item.quantity || 1)}"
          ${disabledAttr}
        >
      </td>
      <td>${Number(totalWeight).toFixed(2).replace(".", ",")}</td>
      <td>${currencyHtml(totalValue)}</td>
      <td>${marginText}</td>
      <td>${totalMarginTonText}</td>
      <td>
        <button type="button" class="remove-item remove-icon-btn" data-item-id="${item.product_id}" aria-label="Remover item" ${disabledAttr}>
          <span aria-hidden="true">-</span>
        </button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  const totals = getCartFormulaTotals();
  const displayedTotalMargin = getDisplayedTotalMargin(totals);
  cartTotalWeight.textContent = `Peso Total: ${totals.totalWeight.toFixed(2).replace(".", ",")}`;
  cartTotal.innerHTML = `Valor Total: ${currencyHtml(totals.totalValue)}`;
  cartTotalMargin.innerHTML = `Margem por Tonelada: ${currencyHtml(displayedTotalMargin)}`;
  updateClientLockState();
  updateCartPaginationControls();
}

function renderClientSuggestions(query) {
  if (!isOrderEditable() || cartItems.length > 0) {
    hideSuggestions(clientSuggestions);
    return;
  }

  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    hideSuggestions(clientSuggestions);
    return;
  }

  const matched = clients
    .filter((client) => client.name.toLowerCase().includes(normalized))
    .slice(0, 8);

  const rows = matched.map((client) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-item";
    button.innerHTML = `<strong>${client.name}</strong>`;
    button.addEventListener("click", () => selectClient(client.id));
    return button;
  });

  showSuggestions(clientSuggestions, rows);
}

function renderProductSuggestions(query) {
  if (!isOrderEditable()) {
    hideSuggestions(productSuggestions);
    return;
  }

  if (!currentOrderRegional) {
    hideSuggestions(productSuggestions);
    return;
  }

  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    hideSuggestions(productSuggestions);
    return;
  }

  const matched = products
    .filter(
      (product) =>
        product.regional === currentOrderRegional &&
        (
          product.name.toLowerCase().includes(normalized) ||
          product.product_code.toLowerCase().includes(normalized)
        )
    )
    .slice(0, 10);

  const rows = matched.map((product) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-item";
    button.innerHTML = `<strong>${product.product_code}</strong> ${product.name} <span>${currencyHtml(product.price_table)}</span>`;
    button.addEventListener("click", () => addProductToCart(product.id));
    return button;
  });

  showSuggestions(productSuggestions, rows);
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

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, role, regional")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar perfil:", error);
    alert("Nao foi possivel carregar perfil. Verifique a tabela profiles.");
    return;
  }

  currentProfile = data || null;

  if (!currentProfile) {
    showProfileModal(true);
    return;
  }

  document.getElementById("profileName").value = currentProfile.display_name;
  document.getElementById("profileRole").value = currentProfile.role;
  document.getElementById("profileRegional").value = currentProfile.regional;
  if (!currentOrderRegional) {
    currentOrderRegional = currentProfile.regional || "";
    orderRegionalSelect.value = currentOrderRegional;
  }
  updateProductInputPlaceholder();
  renderWelcome();
}

async function saveProfile() {
  const supabase = window.supabaseClient;
  const name = document.getElementById("profileName").value.trim();
  const role = document.getElementById("profileRole").value;
  const regional = document.getElementById("profileRegional").value;

  setProfileFeedback("", false);

  if (!name || !role || !regional) {
    setProfileFeedback("Preencha nome, cargo e regional.", true);
    return;
  }

  const { data: existingName, error: nameError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("display_name", name)
    .neq("user_id", currentUser.id)
    .limit(1);

  if (nameError) {
    console.error("Erro ao validar nome:", nameError);
    setProfileFeedback("Erro ao validar nome na base.", true);
    return;
  }

  if (existingName && existingName.length > 0) {
    setProfileFeedback("Esse nome ja esta em uso. Escolha outro.", true);
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
    setProfileFeedback("Nao foi possivel salvar perfil.", true);
    return;
  }

  currentProfile = {
    display_name: name,
    role,
    regional,
  };

  renderWelcome();
  setProfileFeedback("Perfil salvo com sucesso.", false);
  lockedProfileModal = false;
  profileModal.classList.add("hidden");
}

async function loadClients() {
  const supabase = window.supabaseClient;
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, email, phone, payment_term, price_table, billing_unit")
    .eq("user_id", currentUser.id)
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao carregar clientes:", error);
    alert("Nao foi possivel carregar clientes.");
    return;
  }

  clients = data || [];
}

async function loadProducts() {
  const supabase = window.supabaseClient;
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao carregar produtos:", error);
    alert("Nao foi possivel carregar produtos.");
    return;
  }

  products = data || [];
}

function selectClient(clientId) {
  if (!isOrderEditable()) return;
  const selected = clients.find((item) => item.id === clientId);
  if (!selected) return;

  if (cartItems.length > 0 && currentOrderClientId && currentOrderClientId !== clientId) {
    alert("Este pedido ja esta vinculado a outro cliente.");
    return;
  }

  currentOrderClientId = clientId;
  clientSearchInput.value = selected.name;
  hideSuggestions(clientSuggestions);
  updateClientLockState();
}

function addProductToCart(productId) {
  if (!isOrderEditable()) return;
  if (!currentOrderClientId) {
    alert("Selecione um cliente antes de adicionar itens.");
    return;
  }

  if (!currentOrderRegional) {
    alert("Selecione a regional dos itens antes de adicionar produtos.");
    return;
  }

  const product = products.find((item) => item.id === productId);
  if (!product) {
    alert("Produto nao encontrado.");
    return;
  }

  if (product.regional !== currentOrderRegional) {
    alert("Este produto pertence a outra regional.");
    return;
  }

  const existingIndex = cartItems.findIndex((item) => item.product_id === productId);
  if (existingIndex >= 0) {
    cartItems[existingIndex].quantity += 1;
    renderCartTable();
    productSearchInput.value = "";
    hideSuggestions(productSuggestions);
    return;
  }

  cartItems.push({
    client_id: currentOrderClientId,
    product_id: product.id,
    product_label: `${product.product_code} - ${product.name}`,
    table_price: Number(product.price_table || 0),
    margin_zero_price: Number(product.price_margin_zero || 0),
    variable_value: Number(product.variable_value || 0),
    negotiated_price: Number(product.price_table || 0),
    unit_weight: Number(product.weight ?? product.test_value ?? 0),
    quantity: 1,
  });

  renderCartTable();
  productSearchInput.value = "";
  hideSuggestions(productSuggestions);
}

function removeCartItem(productId) {
  if (!isOrderEditable()) return;
  cartItems = cartItems.filter((item) => item.product_id !== productId);
  if (cartItems.length === 0) {
    currentOrderClientId = null;
    cartCurrentPage = 1;
    clientSearchInput.value = "";
    updateClientLockState();
  }
  renderCartTable();
}

function updateNegotiatedPrice(productId, rawValue) {
  if (!isOrderEditable()) return;
  const parsedValue = parsePtBrNumber(rawValue);
  if (parsedValue === null || Number.isNaN(parsedValue) || parsedValue < 0) {
    return;
  }

  const item = cartItems.find((entry) => entry.product_id === productId);
  if (!item) return;
  item.negotiated_price = parsedValue;
  renderCartTable();
}

function updateQuantity(productId, rawValue) {
  if (!isOrderEditable()) return;
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return;
  }

  const item = cartItems.find((entry) => entry.product_id === productId);
  if (!item) return;
  item.quantity = parsed;
  renderCartTable();
}

function validateEditableOrderBase() {
  if (!isOrderEditable()) {
    alert("Este pedido nao pode mais ser alterado.");
    return false;
  }

  if (!currentOrderClientId) {
    alert("Selecione um cliente para o pedido.");
    return false;
  }

  if (!currentOrderRegional) {
    alert("Selecione a regional do pedido.");
    return false;
  }

  return true;
}

function validateItemsForSave() {
  const hasInvalidNegotiatedPrice = cartItems.some(
    (item) => Number.isNaN(Number(item.negotiated_price)) || Number(item.negotiated_price) < 0
  );
  const hasInvalidQuantity = cartItems.some(
    (item) => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0
  );

  if (hasInvalidNegotiatedPrice) {
    alert("Existe item com preco negociado invalido.");
    return false;
  }
  if (hasInvalidQuantity) {
    alert("Existe item com quantidade invalida.");
    return false;
  }

  return true;
}

async function persistOrderDraft() {
  const supabase = window.supabaseClient;
  const total = getCartTotal();

  if (!validateEditableOrderBase()) {
    return null;
  }

  if (!validateItemsForSave()) {
    return null;
  }

  if (!currentOrderId) {
    let orderRow = null;
    let orderError = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      let identity;
      try {
        identity = await generateNextOrderIdentity();
      } catch (error) {
        console.error("Erro ao gerar identidade do pedido:", error);
        alert("Nao foi possivel gerar o ID do pedido. Verifique a regional do perfil.");
        return null;
      }

      const orderPayload = {
        user_id: currentUser.id,
        client_id: currentOrderClientId,
        regional: identity.regional,
        order_seq: identity.orderSeq,
        order_code: identity.orderCode,
        total,
        status: "em_criacao",
      };

      const response = await supabase
        .from("orders")
        .insert(orderPayload)
        .select("id, order_code, status")
        .single();

      orderRow = response.data || null;
      orderError = response.error || null;

      if (!orderError) {
        break;
      }

      if (orderError.code !== "23505") {
        break;
      }
    }

    if (orderError || !orderRow) {
      console.error("Erro ao salvar pedido:", orderError);
      alert("Nao foi possivel salvar o pedido.");
      return null;
    }

    currentOrderId = orderRow.id;
    currentOrderCode = orderRow.order_code;
    currentOrderStatus = orderRow.status || "em_criacao";
  } else {
    const { data: updatedOrder, error: updateOrderError } = await supabase
      .from("orders")
      .update({
        client_id: currentOrderClientId,
        regional: currentOrderRegional,
        total,
      })
      .eq("id", currentOrderId)
      .eq("user_id", currentUser.id)
      .in("status", ["em_criacao", "aberto"])
      .select("id, order_code, status")
      .single();

    if (updateOrderError || !updatedOrder) {
      console.error("Erro ao atualizar pedido:", updateOrderError);
      alert("Nao foi possivel atualizar o pedido. Ele pode nao estar mais em criacao.");
      return null;
    }

    currentOrderCode = updatedOrder.order_code;
    currentOrderStatus = updatedOrder.status || "em_criacao";
  }

  const { error: deleteItemsError } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", currentOrderId);

  if (deleteItemsError) {
    console.error("Erro ao atualizar itens do pedido:", deleteItemsError);
    alert("Nao foi possivel atualizar itens do pedido.");
    return null;
  }

  if (cartItems.length > 0) {
    const itemsPayload = cartItems.map((item) => ({
      order_id: currentOrderId,
      product_id: item.product_id,
      quantity: Number(item.quantity),
      unit_price: Number(item.negotiated_price),
    }));

    const { error: itemInsertError } = await supabase.from("order_items").insert(itemsPayload);
    if (itemInsertError) {
      console.error("Erro ao salvar itens do pedido:", itemInsertError);
      alert("Pedido salvo, mas houve erro ao salvar os itens.");
      return null;
    }
  }

  updateOrderHeader();
  updateInputLockState();
  return {
    id: currentOrderId,
    order_code: currentOrderCode,
    status: currentOrderStatus,
    regional: currentOrderRegional || "-",
  };
}

async function saveOrderDraft() {
  const order = await persistOrderDraft();
  if (!order) return;
  alert(`Pedido ${order.order_code} salvo em criacao.`);
}

async function finalizeOrder() {
  const supabase = window.supabaseClient;

  if (cartItems.length === 0) {
    alert("Adicione itens ao pedido antes de finalizar.");
    return;
  }

  const order = await persistOrderDraft();
  if (!order) return;

  const { data: finalizedOrder, error: finalizeError } = await supabase
    .from("orders")
    .update({ status: "finalizado" })
    .eq("id", order.id)
    .eq("user_id", currentUser.id)
    .in("status", ["em_criacao", "aberto"])
    .select("id, order_code, regional, status")
    .single();

  if (finalizeError || !finalizedOrder) {
    console.error("Erro ao finalizar pedido:", finalizeError);
    alert("Nao foi possivel finalizar pedido.");
    return;
  }

  const selectedClient = getSelectedClient();
  const itemsSnapshot = cartItems.map((item) => ({ ...item }));
  const totalsSnapshot = getCartFormulaTotals();

  currentOrderStatus = "finalizado";
  updateOrderHeader();
  updateInputLockState();
  renderCartTable();

  try {
    downloadOrderPdf(finalizedOrder, selectedClient?.name || "-", itemsSnapshot, totalsSnapshot);
  } catch (error) {
    console.error("Erro ao gerar PDF do pedido:", error);
  }

  alert(`Pedido ${finalizedOrder.order_code} finalizado com sucesso.`);
}

async function cancelOrder() {
  const supabase = window.supabaseClient;

  if (!currentOrderId) {
    alert("Salve o pedido antes de cancelar.");
    return;
  }

  if (!isOrderEditable()) {
    alert("Este pedido nao pode mais ser cancelado.");
    return;
  }

  if (!window.confirm("Deseja realmente cancelar este pedido?")) return;

  const { data, error } = await supabase
    .from("orders")
    .update({ status: "cancelado" })
    .eq("id", currentOrderId)
    .eq("user_id", currentUser.id)
    .in("status", ["em_criacao", "aberto"])
    .select("id, order_code, status")
    .single();

  if (error || !data) {
    console.error("Erro ao cancelar pedido:", error);
    alert("Nao foi possivel cancelar o pedido.");
    return;
  }

  currentOrderStatus = "cancelado";
  updateOrderHeader();
  updateInputLockState();
  renderCartTable();
  alert(`Pedido ${data.order_code} cancelado.`);
}

function resolveOrderIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("orderId") || "";
}

async function loadOrderForEditIfNeeded() {
  const supabase = window.supabaseClient;
  const orderId = resolveOrderIdFromQuery().trim();
  if (!orderId) {
    updateOrderHeader();
    updateInputLockState();
    return;
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_code, client_id, regional, status")
    .eq("id", orderId)
    .eq("user_id", currentUser.id)
    .single();

  if (orderError || !order) {
    console.error("Erro ao carregar pedido para edicao:", orderError);
    alert("Nao foi possivel carregar o pedido para edicao.");
    window.location.href = "orders-consult.html";
    return;
  }

  currentOrderId = order.id;
  currentOrderCode = order.order_code;
  currentOrderClientId = order.client_id;
  currentOrderRegional = order.regional || "";
  orderRegionalSelect.value = currentOrderRegional;
  updateProductInputPlaceholder();
  currentOrderStatus = order.status || "em_criacao";

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_id, quantity, unit_price, products(product_code, name, weight, price_table, price_margin_zero, variable_value)")
    .eq("order_id", currentOrderId);

  if (itemsError) {
    console.error("Erro ao carregar itens do pedido:", itemsError);
    alert("Nao foi possivel carregar os itens do pedido.");
    window.location.href = "orders-consult.html";
    return;
  }

  cartItems = (items || []).map((row) => {
    const product = row.products || {};
    return {
      client_id: currentOrderClientId,
      product_id: row.product_id,
      product_label: `${product.product_code || "-"} - ${product.name || "-"}`,
      table_price: Number(product.price_table || 0),
      margin_zero_price: Number(product.price_margin_zero || 0),
      variable_value: Number(product.variable_value || 0),
      negotiated_price: Number(row.unit_price || 0),
      unit_weight: Number(product.weight || 0),
      quantity: Number(row.quantity || 1),
    };
  });

  const selectedClient = getSelectedClient();
  if (selectedClient) {
    clientSearchInput.value = selectedClient.name;
  }

  updateOrderHeader();
  updateInputLockState();
  renderCartTable();
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

function bindEvents() {
  document.getElementById("saveProfileButton").addEventListener("click", saveProfile);
  document.getElementById("saveOrderButton").addEventListener("click", saveOrderDraft);
  document.getElementById("finalizeOrderButton").addEventListener("click", finalizeOrder);
  document.getElementById("cancelOrderButton").addEventListener("click", cancelOrder);
  document.getElementById("logoutButton").addEventListener("click", logout);

  clientSearchInput.addEventListener("input", (event) => {
    renderClientSuggestions(event.target.value);
  });
  clientSearchInput.addEventListener("focus", (event) => {
    renderClientSuggestions(event.target.value);
  });

  productSearchInput.addEventListener("input", (event) => {
    renderProductSuggestions(event.target.value);
  });
  productSearchInput.addEventListener("focus", (event) => {
    renderProductSuggestions(event.target.value);
  });

  orderRegionalSelect.addEventListener("change", (event) => {
    setOrderRegional(event.target.value);
    renderProductSuggestions(productSearchInput.value);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".autocomplete-wrap")) {
      hideSuggestions(clientSuggestions);
      hideSuggestions(productSuggestions);
    }
  });

  document.getElementById("cartTableBody").addEventListener("click", (event) => {
    const removeButton = event.target.closest(".remove-item");
    if (!removeButton) return;
    const productId = removeButton.getAttribute("data-item-id");
    if (!productId) return;
    removeCartItem(productId);
  });

  function handleCartInlineEdit(event) {
    const negotiatedInput = event.target.closest(".negotiated-input");
    if (negotiatedInput) {
      const productId = negotiatedInput.getAttribute("data-item-id");
      if (!productId) return;
      updateNegotiatedPrice(productId, negotiatedInput.value);
      return;
    }

    const quantityInput = event.target.closest(".quantity-input");
    if (!quantityInput) return;
    const productId = quantityInput.getAttribute("data-item-id");
    if (!productId) return;
    updateQuantity(productId, quantityInput.value);
  }

  document.getElementById("cartTableBody").addEventListener("change", handleCartInlineEdit);

  document.getElementById("cartPrevPageButton").addEventListener("click", () => {
    if (cartCurrentPage <= 1) return;
    cartCurrentPage -= 1;
    renderCartTable();
  });

  document.getElementById("cartNextPageButton").addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(cartItems.length / cartPageSize));
    if (cartCurrentPage >= totalPages) return;
    cartCurrentPage += 1;
    renderCartTable();
  });

  profileModal.addEventListener("click", (event) => {
    if (event.target === profileModal) {
      hideProfileModal();
    }
  });
}

async function initDashboard() {
  bindEvents();
  updateProductInputPlaceholder();

  currentUser = await getSessionUser();
  if (!currentUser) return;

  await loadProfile();
  await loadClients();
  await loadProducts();
  await loadOrderForEditIfNeeded();
  updateOrderHeader();
  updateClientLockState();
  renderCartTable();
}

document.addEventListener("DOMContentLoaded", initDashboard);
