const SUPABASE_URL = "https://jlabpujctouvunxpvtny.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_20aNqithPS-wbJ86F4jz1Q_0JivBCiQ";


// CDN exposes it as `supabase` object with createClient method
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
