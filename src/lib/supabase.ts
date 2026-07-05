import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rkzyzchuyabgpxbteygu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrenl6Y2h1eWFiZ3B4YnRleWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxODEzMjcsImV4cCI6MjA5ODc1NzMyN30.e9oXjYPGOaUrOBUxYoso8MrzIADNJlDbd0Nf3QfHH6k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
