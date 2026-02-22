let currentUser = null;

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

function setFeedback(message, isError) {
  const feedback = document.getElementById("productFeedback");
  feedback.textContent = message || "";
  feedback.classList.toggle("error", Boolean(isError));
}

function renderComputedMargin() {
  const priceTable = parsePtBrNumber(document.getElementById("productPriceTable").value);
  const priceMarginZero = parsePtBrNumber(document.getElementById("productPriceMarginZero").value);
  const variableValue = parsePtBrNumber(document.getElementById("productVariableValue").value);
  const marginInput = document.getElementById("productComputedMargin");
  const marginInfo = document.getElementById("productComputedMarginInfo");

  if (
    priceTable === null ||
    priceMarginZero === null ||
    variableValue === null ||
    Number.isNaN(priceTable) ||
    Number.isNaN(priceMarginZero) ||
    Number.isNaN(variableValue)
  ) {
    marginInput.value = "";
    marginInfo.textContent = "Margem calculada: -";
    return;
  }

  const denominator = priceTable - priceMarginZero;
  if (denominator === 0) {
    marginInput.value = "Indefinida (divisao por zero)";
    marginInfo.textContent = "Margem calculada: indefinida (divisao por zero)";
    return;
  }

  const computedMargin = variableValue / denominator;
  const formatted = computedMargin.toLocaleString("pt-BR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
  marginInput.value = formatted;
  marginInfo.textContent = `Margem calculada: ${formatted}`;
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

async function saveProduct() {
  const supabase = window.supabaseClient;
  const productCode = document.getElementById("productCode").value.trim();
  const name = document.getElementById("productName").value.trim();
  const rawPriceTable = document.getElementById("productPriceTable").value;
  const rawPriceMarginZero = document.getElementById("productPriceMarginZero").value;
  const rawWeight = document.getElementById("productWeight").value.trim();
  const rawVariableValue = document.getElementById("productVariableValue").value.trim();

  const priceTable = parsePtBrNumber(rawPriceTable);
  const priceMarginZero = parsePtBrNumber(rawPriceMarginZero);
  const weight = parsePtBrNumber(rawWeight);
  const variableValue = parsePtBrNumber(rawVariableValue);

  setFeedback("", false);

  if (!productCode || !name) {
    setFeedback("Informe ID e nome do produto.", true);
    return;
  }

  if (priceTable === null || Number.isNaN(priceTable) || priceTable < 0) {
    setFeedback("Informe um preco de tabela valido.", true);
    return;
  }

  if (priceMarginZero === null || Number.isNaN(priceMarginZero) || priceMarginZero < 0) {
    setFeedback("Informe um preco margem 0 valido.", true);
    return;
  }

  if (weight === null || Number.isNaN(weight) || weight < 0) {
    setFeedback("Informe um peso valido.", true);
    return;
  }

  if (variableValue === null || Number.isNaN(variableValue) || variableValue < 0) {
    setFeedback("Informe um valor de variavel valido.", true);
    return;
  }

  if (priceTable - priceMarginZero === 0) {
    setFeedback("A diferenca entre preco de tabela e preco margem 0 nao pode ser zero.", true);
    return;
  }

  const payload = {
    user_id: currentUser.id,
    product_code: productCode,
    name,
    price_table: priceTable,
    price_margin_zero: priceMarginZero,
    weight,
    variable_value: variableValue,
  };

  const { error } = await supabase.from("products").insert(payload);

  if (error) {
    console.error("Erro ao salvar produto:", error);
    setFeedback(`Erro ao salvar produto na base: ${error.message}`, true);
    return;
  }

  document.getElementById("productCode").value = "";
  document.getElementById("productName").value = "";
  document.getElementById("productPriceTable").value = "";
  document.getElementById("productPriceMarginZero").value = "";
  document.getElementById("productWeight").value = "";
  document.getElementById("productVariableValue").value = "";
  document.getElementById("productComputedMargin").value = "";
  document.getElementById("productComputedMarginInfo").textContent = "Margem calculada: -";
  setFeedback("Produto salvo com sucesso.", false);
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

async function initProductsPage() {
  document.getElementById("productPriceTable").addEventListener("input", renderComputedMargin);
  document.getElementById("productPriceMarginZero").addEventListener("input", renderComputedMargin);
  document.getElementById("productVariableValue").addEventListener("input", renderComputedMargin);
  renderComputedMargin();

  currentUser = await getSessionUser();
  if (!currentUser) return;

  document.getElementById("saveProductButton").addEventListener("click", saveProduct);
  document.getElementById("logoutButton").addEventListener("click", logout);
}

document.addEventListener("DOMContentLoaded", initProductsPage);
