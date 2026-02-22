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

  const orderPayload = {
    user_id: currentUser.id,
    client_id: currentOrderClientId,
    total,
    status: "aberto",
  };

  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert(orderPayload)
    .select("id")
    .single();

  if (orderError) {
    console.error("Erro ao salvar pedido:", orderError);
    alert("Nao foi possivel finalizar pedido. Verifique a tabela orders.");
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

  cartItems = [];
  currentOrderClientId = null;
  cartCurrentPage = 1;
  clientSearchInput.value = "";
  productSearchInput.value = "";
  hideSuggestions(clientSuggestions);
  hideSuggestions(productSuggestions);
  updateClientLockState();
  renderCartTable();
  alert("Pedido finalizado com sucesso.");
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
