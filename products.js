let currentUser = null;
const ALLOWED_REGIONALS = ["ESPIRITO SANTO", "RIO DE JANEIRO"];
const csvFieldAliases = {
  product_code: ["product_code", "id", "codigo", "codigo_produto", "id_produto"],
  name: ["name", "nome", "nome_produto", "produto"],
  regional: ["regional", "regiao", "regiao_produto"],
  price_table: ["price_table", "preco_tabela", "preco_de_tabela", "valor_tabela"],
  price_margin_zero: ["price_margin_zero", "preco_tabela_0", "preco_margem_0", "preco_zero"],
  weight: ["weight", "peso"],
  variable_value: ["variable_value", "variavel", "valor_variavel"],
};

function normalizeRegional(rawValue) {
  const normalized = String(rawValue || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");

  if (normalized === "ESPIRITO SANTO") return "ESPIRITO SANTO";
  if (normalized === "RIO DE JANEIRO") return "RIO DE JANEIRO";
  return "";
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

function setFeedback(message, isError) {
  const feedback = document.getElementById("productFeedback");
  feedback.textContent = message || "";
  feedback.classList.toggle("error", Boolean(isError));
}

function setCsvFeedback(message, isError) {
  const feedback = document.getElementById("productCsvFeedback");
  feedback.textContent = message || "";
  feedback.classList.toggle("error", Boolean(isError));
}

function normalizeHeader(header) {
  return String(header || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseCsvText(csvText) {
  const text = String(csvText || "").replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = firstLine.includes(";") ? ";" : ",";
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === "\"") {
      if (inQuotes && text[i + 1] === "\"") {
        value += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(value);
      value = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  rows.push(row);
  return rows.filter((entry) => entry.some((cell) => String(cell || "").trim() !== ""));
}

function getCsvValueByField(rawRow, headerMap, canonicalField) {
  const aliases = csvFieldAliases[canonicalField] || [];
  for (const alias of aliases) {
    const index = headerMap[alias];
    if (index === undefined) continue;
    return String(rawRow[index] || "").trim();
  }
  return "";
}

async function importProductsFromCsv() {
  const supabase = window.supabaseClient;
  const fileInput = document.getElementById("productsCsvFile");
  const file = fileInput.files?.[0];

  setCsvFeedback("", false);

  if (!file) {
    setCsvFeedback("Selecione um arquivo CSV.", true);
    return;
  }

  let csvText = "";
  try {
    csvText = await file.text();
  } catch (error) {
    console.error("Erro ao ler CSV:", error);
    setCsvFeedback("Nao foi possivel ler o arquivo CSV.", true);
    return;
  }

  const rows = parseCsvText(csvText);
  if (rows.length < 2) {
    setCsvFeedback("CSV vazio ou sem linhas de dados.", true);
    return;
  }

  const rawHeaders = rows[0].map((item) => normalizeHeader(item));
  const headerMap = {};
  rawHeaders.forEach((header, index) => {
    if (!(header in headerMap)) {
      headerMap[header] = index;
    }
  });

  const requiredFields = ["product_code", "name", "regional", "price_table", "price_margin_zero", "weight", "variable_value"];
  const missingFields = requiredFields.filter((field) => {
    const aliases = csvFieldAliases[field];
    return !aliases.some((alias) => headerMap[alias] !== undefined);
  });

  if (missingFields.length > 0) {
    setCsvFeedback(`CSV sem colunas obrigatorias: ${missingFields.join(", ")}`, true);
    return;
  }

  const payload = [];
  const errors = [];

  for (let i = 1; i < rows.length; i += 1) {
    const lineNumber = i + 1;
    const rawRow = rows[i];

    const productCode = getCsvValueByField(rawRow, headerMap, "product_code");
    const name = getCsvValueByField(rawRow, headerMap, "name");
    const regional = normalizeRegional(getCsvValueByField(rawRow, headerMap, "regional"));
    const priceTable = parsePtBrNumber(getCsvValueByField(rawRow, headerMap, "price_table"));
    const priceMarginZero = parsePtBrNumber(getCsvValueByField(rawRow, headerMap, "price_margin_zero"));
    const weight = parsePtBrNumber(getCsvValueByField(rawRow, headerMap, "weight"));
    const variableValue = parsePtBrNumber(getCsvValueByField(rawRow, headerMap, "variable_value"));

    if (!productCode || !name) {
      errors.push(`Linha ${lineNumber}: product_code e name sao obrigatorios.`);
      continue;
    }

    if (!regional || !ALLOWED_REGIONALS.includes(regional)) {
      errors.push(`Linha ${lineNumber}: regional invalida. Use ESPIRITO SANTO ou RIO DE JANEIRO.`);
      continue;
    }

    if (
      priceTable === null || Number.isNaN(priceTable) || priceTable < 0 ||
      priceMarginZero === null || Number.isNaN(priceMarginZero) || priceMarginZero < 0 ||
      weight === null || Number.isNaN(weight) || weight < 0 ||
      variableValue === null || Number.isNaN(variableValue) || variableValue < 0
    ) {
      errors.push(`Linha ${lineNumber}: campos numericos invalidos.`);
      continue;
    }

    if (priceTable - priceMarginZero === 0) {
      errors.push(`Linha ${lineNumber}: preco_tabela e preco_tabela_0 nao podem ter diferenca zero.`);
      continue;
    }

    payload.push({
      user_id: currentUser.id,
      product_code: productCode,
      name,
      regional,
      price_table: priceTable,
      price_margin_zero: priceMarginZero,
      weight,
      variable_value: variableValue,
    });
  }

  if (payload.length === 0) {
    setCsvFeedback(errors.slice(0, 3).join(" "), true);
    return;
  }

  const { error } = await supabase
    .from("products")
    .upsert(payload, { onConflict: "user_id,regional,product_code" });

  if (error) {
    console.error("Erro ao importar CSV:", error);
    setCsvFeedback(`Erro ao importar CSV: ${error.message}`, true);
    return;
  }

  const skippedCount = rows.length - 1 - payload.length;
  const summary = `Importacao concluida: ${payload.length} linha(s) processada(s).${skippedCount > 0 ? ` ${skippedCount} linha(s) ignorada(s).` : ""}`;
  const detail = errors.length > 0 ? ` Erros: ${errors.slice(0, 3).join(" ")}` : "";
  setCsvFeedback(`${summary}${detail}`, false);
  fileInput.value = "";
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
  const regional = normalizeRegional(document.getElementById("productRegional").value);
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

  if (!regional || !ALLOWED_REGIONALS.includes(regional)) {
    setFeedback("Informe a regional do produto.", true);
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
    regional,
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
  document.getElementById("productRegional").value = "";
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
  document.getElementById("importProductsCsvButton").addEventListener("click", importProductsFromCsv);
  document.getElementById("logoutButton").addEventListener("click", logout);
}

document.addEventListener("DOMContentLoaded", initProductsPage);
