async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const supabase = window.supabaseClient;

  console.log("Tentando logar com:", email, password);

  if (!email || !password) {
    alert("Preencha e-mail e senha!");
    return;
  }

  if (!supabase) {
    alert("Falha na inicializacao do Supabase. Recarregue a pagina.");
    return;
  }

  try {
    const result = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log("Resultado Supabase:", result);

    if (result.error) {
      alert("Erro: " + result.error.message);
      return;
    }

    if (!result.data.session) {
      alert("Nao logado: sessao nao retornada.");
      return;
    }

    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("Erro no auth.signInWithPassword", err);
    alert("Erro inesperado");
  }
}

async function signup() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const supabase = window.supabaseClient;

  if (!email || !password) {
    alert("Preencha e-mail e senha para cadastrar!");
    return;
  }

  if (password.length < 6) {
    alert("A senha precisa ter pelo menos 6 caracteres.");
    return;
  }

  if (!supabase) {
    alert("Falha na inicializacao do Supabase. Recarregue a pagina.");
    return;
  }

  try {
    const result = await supabase.auth.signUp({
      email,
      password,
    });

    if (result.error) {
      alert("Erro ao cadastrar: " + result.error.message);
      return;
    }

    if (result.data.session) {
      window.location.href = "dashboard.html";
      return;
    }

    alert("Cadastro realizado! Verifique seu e-mail para confirmar a conta.");
  } catch (err) {
    console.error("Erro no auth.signUp", err);
    alert("Erro inesperado ao cadastrar.");
  }
}
