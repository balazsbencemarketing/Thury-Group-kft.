// Shared Supabase config — used by admin/, portfolio.html, gepberles.html, index.html
window.SUPABASE_URL      = "https://xspffmognnwmjkmwdsut.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcGZmbW9nbm53bWprbXdkc3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDAzNTMsImV4cCI6MjA5NTIxNjM1M30.FSALngsnWuQQ9wk1JuSbJnHI0UXWiWzr40ueXzBbvMM";
window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
