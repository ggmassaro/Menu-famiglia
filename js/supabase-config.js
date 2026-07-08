// Configurazione Supabase
const SUPABASE_URL = "https://bcwrjloffnbirrpmpsvq.supabase.co";
const SUPABASE_KEY = "sb_publishable_lLCkqDbieLuOHHWBOnnnig_dkegSuXs";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
