const SUPABASE_URL = "https://tqgkbeugtnxbylduglai.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZ2tiZXVndG54YnlsZHVnbGFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NTc5MjQsImV4cCI6MjA4NzMzMzkyNH0.vlokq-7t0SnVT0df6RN0OP8JfrdEOmOKeptuRAfrH10";

const supabaseLib = window.supabase;

if (!supabaseLib || typeof supabaseLib.createClient !== "function") {
  console.error("SDK do Supabase nao carregou corretamente.");
} else {
  window.supabaseClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
