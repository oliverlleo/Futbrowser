// ============================================================
// Futbrowser — Supabase Client Configuration
// ============================================================
// Shared initialization for every page that needs Supabase.
// Import this file AFTER the Supabase CDN script.
// ============================================================

const SUPABASE_URL = "https://aqbikkjvosxvlysbzpvr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxYmlra2p2b3N4dmx5c2J6cHZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzA4NDcsImV4cCI6MjA5NDM0Njg0N30.lVY-rcbQnizN7g0v3PLoNichblf80f-b4IKhojxCc3Q";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
