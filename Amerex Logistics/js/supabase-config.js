// supabase-config.js

const supabaseUrl = "https://kkizfqzuegwkhmeeigjg.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtraXpmcXp1ZWd3a2htZWVpZ2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNDU5NzEsImV4cCI6MjA4MzcyMTk3MX0.zUTHPpWr_GcHEUrmiL9CZcuHp14B-mFMyPl1oPWSwAc";

// Create ONE shared client
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

window.supabaseClient = supabaseClient;
console.log("✅ Supabase initialized:", supabaseUrl);
