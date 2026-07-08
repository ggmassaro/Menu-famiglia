import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://devccplrbeogwtyypjcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ymiGmc-ZZhERicwMUFVmzg_LFEqGd7I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
