let currentUser = null;
let currentProfile = null;
let clients = [];
let products = [];
let cartItems = [];
let currentOrderClientId = null;
let lockedProfileModal = false;
let cartCurrentPage = 1;
const cartPageSize = 8;

const profileModal = document.getElementById("profileModal");
const welcomeName = document.getElementById("welcomeName");
const welcomeMeta = document.getElementById("welcomeMeta");
const selectedClientInfo = document.getElementById("selectedClientInfo");
const clientSearchInput = document.getElementById("clientSearchInput");
const clientSuggestions = document.getElementById("clientSuggestions");
const productSearchInput = document.getElementById("productSearchInput");
const productSuggestions = document.getElementById("productSuggestions");

function moneyBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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

function updateClientLockState() {
  const hasItems = cartItems.length > 0;
  clientSearchInput.disabled = hasItems;
  if (hasItems) {
    const client = getSelectedClient();
    selectedClientInfo.textContent = client ? `Cliente do pedido: ${client.name}` : "";
    return;
  }

  selectedClientInfo.textContent = "";
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
  pdf.text("Margem T", 186, y);
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
  pdf.text(`Peso Total: ${numberBR(totals.totalWeight)}`, 14, y);
  y += 5;
  pdf.text(`Valor Total: ${moneyBRL(totals.totalValue)}`, 14, y);
  y += 5;
  pdf.text(`Margem Total: ${moneyBRL(totals.totalMargin)}`, 14, y);
  y += 5;
  pdf.text(`Margem Total (T): ${moneyBRL(totals.totalMarginTon)}`, 14, y);

  pdf.save(`${orderRow.order_code}.pdf`);
}

function getRegionalPrefix(regional) {
  if (regional === "ESPIRITO SANTO") return "ES";
  if (regional === "RIO DE JANEIRO") return "RJ";
  return "XX";
}

async function generateNextOrderIdentity() {
  const supabase = window.supabaseClient;
  const regional = currentProfile?.regional;

  if (!regional) {
    throw new Error("Regional do perfil nao encontrada.");
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
  const cartTotalMarginTon = document.getElementById("cartTotalMarginTon");
  tableBody.innerHTML = "";

  if (cartItems.length === 0) {
    tableBody.innerHTML = "<tr><td colspan='9' class='empty-cell'>Nenhum item no pedido.</td></tr>";
    cartTotalWeight.textContent = "Peso Total: 0,00";
    cartTotal.textContent = `Valor Total: ${moneyBRL(0)}`;
    cartTotalMargin.textContent = `Margem Total: ${moneyBRL(0)}`;
    cartTotalMarginTon.textContent = `Margem Total (T): ${moneyBRL(0)}`;
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
      : moneyBRL(margin);
    const totalMarginTonText = totalMarginTon === null || Number.isNaN(totalMarginTon)
      ? "-"
      : moneyBRL(totalMarginTon);
    tr.innerHTML = `
      <td>${item.product_label}</td>
      <td>${moneyBRL(item.table_price)}</td>
      <td>
        <input
          type="text"
          class="negotiated-input"
          data-item-id="${item.product_id}"
          value="${Number(item.negotiated_price).toFixed(2).replace(".", ",")}"
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
        >
      </td>
      <td>${Number(totalWeight).toFixed(2).replace(".", ",")}</td>
      <td>${moneyBRL(totalValue)}</td>
      <td>${marginText}</td>
      <td>${totalMarginTonText}</td>
      <td>
        <button type="button" class="remove-item remove-icon-btn" data-item-id="${item.product_id}" aria-label="Remover item">
          <span aria-hidden="true">-</span>
        </button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  const totals = getCartFormulaTotals();
  cartTotalWeight.textContent = `Peso Total: ${totals.totalWeight.toFixed(2).replace(".", ",")}`;
  cartTotal.textContent = `Valor Total: ${moneyBRL(totals.totalValue)}`;
  cartTotalMargin.textContent = `Margem Total: ${moneyBRL(totals.totalMargin)}`;
  cartTotalMarginTon.textContent = `Margem Total (T): ${moneyBRL(totals.totalMarginTon)}`;
  updateClientLockState();
  updateCartPaginationControls();
}

function renderClientSuggestions(query) {
  if (cartItems.length > 0) {
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
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    hideSuggestions(productSuggestions);
    return;
  }

  const matched = products
    .filter(
      (product) =>
        product.name.toLowerCase().includes(normalized) ||
        product.product_code.toLowerCase().includes(normalized)
    )
    .slice(0, 10);

  const rows = matched.map((product) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-item";
    button.innerHTML = `<strong>${product.product_code}</strong> ${product.name} <span>${moneyBRL(product.price_table)}</span>`;
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
    .select("id, name")
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
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao carregar produtos:", error);
    alert("Nao foi possivel carregar produtos.");
    return;
  }

  products = data || [];
}

function selectClient(clientId) {
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
  if (!currentOrderClientId) {
    alert("Selecione um cliente antes de adicionar itens.");
    return;
  }

  const product = products.find((item) => item.id === productId);
  if (!product) {
    alert("Produto nao encontrado.");
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
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return;
  }

  const item = cartItems.find((entry) => entry.product_id === productId);
  if (!item) return;
  item.quantity = parsed;
  renderCartTable();
}

async function finalizeOrder() {
  const supabase = window.supabaseClient;

  if (!currentOrderClientId) {
    alert("Selecione um cliente para o pedido.");
    return;
  }

  if (cartItems.length === 0) {
    alert("Adicione itens ao pedido antes de finalizar.");
    return;
  }

  const hasInvalidNegotiatedPrice = cartItems.some(
    (item) => Number.isNaN(Number(item.negotiated_price)) || Number(item.negotiated_price) < 0
  );
  const hasInvalidQuantity = cartItems.some(
    (item) => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0
  );

  if (hasInvalidNegotiatedPrice) {
    alert("Existe item com preco negociado invalido.");
    return;
  }
  if (hasInvalidQuantity) {
    alert("Existe item com quantidade invalida.");
    return;
  }

  const total = getCartTotal();
  const selectedClient = getSelectedClient();
  const itemsSnapshot = cartItems.map((item) => ({ ...item }));
  const totalsSnapshot = getCartFormulaTotals();
  let orderRow = null;
  let orderError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let identity;
    try {
      identity = await generateNextOrderIdentity();
    } catch (error) {
      console.error("Erro ao gerar identidade do pedido:", error);
      alert("Nao foi possivel gerar o ID do pedido. Verifique a regional do perfil.");
      return;
    }

    const orderPayload = {
      user_id: currentUser.id,
      client_id: currentOrderClientId,
      regional: identity.regional,
      order_seq: identity.orderSeq,
      order_code: identity.orderCode,
      total,
      status: "aberto",
    };

    const response = await supabase
      .from("orders")
      .insert(orderPayload)
      .select("id, order_code, regional")
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
    alert("Nao foi possivel finalizar pedido. Rode o script atualizado de database_schema.sql.");
    return;
  }

  const itemsPayload = cartItems.map((item) => ({
    order_id: orderRow.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: Number(item.negotiated_price),
  }));

  const { error: itemError } = await supabase.from("order_items").insert(itemsPayload);

  if (itemError) {
    console.error("Erro ao salvar itens do pedido:", itemError);
    alert("Pedido criado, mas houve erro ao salvar os itens.");
    return;
  }

  try {
    downloadOrderPdf(orderRow, selectedClient?.name || "-", itemsSnapshot, totalsSnapshot);
  } catch (error) {
    console.error("Erro ao gerar PDF do pedido:", error);
  }

  cartItems = [];
  currentOrderClientId = null;
  cartCurrentPage = 1;
  clientSearchInput.value = "";
  productSearchInput.value = "";
  hideSuggestions(clientSuggestions);
  hideSuggestions(productSuggestions);
  updateClientLockState();
  renderCartTable();
  alert(`Pedido ${orderRow.order_code} finalizado com sucesso.`);
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
  document.getElementById("finalizeOrderButton").addEventListener("click", finalizeOrder);
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

  currentUser = await getSessionUser();
  if (!currentUser) return;

  await loadProfile();
  await loadClients();
  await loadProducts();
  updateClientLockState();
  renderCartTable();
}

document.addEventListener("DOMContentLoaded", initDashboard);
