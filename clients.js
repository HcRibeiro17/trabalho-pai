let currentUser = null;

function setFeedback(message, isError) {
  const feedback = document.getElementById("clientFeedback");
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

async function saveClient() {
  const supabase = window.supabaseClient;
  const name = document.getElementById("clientName").value.trim();
  const email = document.getElementById("clientEmail").value.trim();
  const phone = document.getElementById("clientPhone").value.trim();
  const paymentTerm = document.getElementById("clientPaymentTerm").value.trim();
  const priceTable = document.getElementById("clientPriceTable").value.trim();
  const billingUnit = document.getElementById("clientBillingUnit").value.trim();

  setFeedback("", false);

  if (!name) {
    setFeedback("Informe o nome do cliente.", true);
    return;
  }

  const payload = {
    user_id: currentUser.id,
    name,
    email: email || null,
    phone: phone || null,
    payment_term: paymentTerm || null,
    price_table: priceTable || null,
    billing_unit: billingUnit || null,
  };

  const { error } = await supabase.from("clients").insert(payload);

  if (error) {
    console.error("Erro ao salvar cliente:", error);
    setFeedback(`Erro ao salvar cliente na base: ${error.message}`, true);
    return;
  }

  document.getElementById("clientName").value = "";
  document.getElementById("clientEmail").value = "";
  document.getElementById("clientPhone").value = "";
  document.getElementById("clientPaymentTerm").value = "";
  document.getElementById("clientPriceTable").value = "";
  document.getElementById("clientBillingUnit").value = "";
  setFeedback("Cliente salvo com sucesso.", false);
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

async function initClientsPage() {
  currentUser = await getSessionUser();
  if (!currentUser) return;

  document.getElementById("saveClientButton").addEventListener("click", saveClient);
  document.getElementById("logoutButton").addEventListener("click", logout);
}

document.addEventListener("DOMContentLoaded", initClientsPage);
