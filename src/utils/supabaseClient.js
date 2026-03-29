import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL
    ? import.meta.env.VITE_SUPABASE_URL
    : process.env.REACT_APP_SUPABASE_URL;

const supabaseAnonKey =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY
    ? import.meta.env.VITE_SUPABASE_ANON_KEY
    : process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export { supabaseUrl };
