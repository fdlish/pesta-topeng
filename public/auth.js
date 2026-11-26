// Login pemain.
//  - Mode "supabase": Google OAuth lewat Supabase Auth (PKCE). Browser hanya memegang
//    sesi login; poin & profil dikelola server.
//  - Mode "local": dipakai jika server belum dikonfigurasi Supabase. Token acak per perangkat.
const LOCAL_KEY = 'pt-local-token';
let client = null, mode = 'local', listener = () => {};

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
}

export async function initAuth(config, onToken) {
  listener = onToken;
  mode = config.mode;
  if (mode !== 'supabase') return;
  try {
    await loadScript('/vendor/supabase/supabase.js');
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    });
    client.auth.onAuthStateChange((event, session) => {
      // Token baru (login / refresh / logout) dikirim ulang ke server.
      if (['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
        setTimeout(() => listener(session?.access_token || null, event), 0);
      }
    });
    // bersihkan ?code= sisa redirect OAuth dari URL
    const u = new URL(location.href);
    if (u.searchParams.has('code')) { u.searchParams.delete('code'); history.replaceState(null, '', u.pathname + (u.search || '')); }
  } catch (e) {
    console.error('Supabase gagal dimuat', e);
    client = null;
  }
}

export function authMode() { return mode; }
export function authReady() { return mode === 'local' || !!client; }

export async function currentToken() {
  if (mode === 'local') { try { return localStorage.getItem(LOCAL_KEY); } catch { return null; } }
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token || null;
}

export async function signIn() {
  if (mode === 'local') {
    const rnd = crypto.getRandomValues(new Uint8Array(24));
    const tk = 'local_' + Array.from(rnd, b => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(LOCAL_KEY, tk); } catch {}
    listener(tk, 'SIGNED_IN');
    return;
  }
  if (!client) throw new Error('Login Google belum siap. Coba muat ulang halaman.');
  // kembali ke halaman yang sama (termasuk ?room= undangan)
  const back = location.origin + location.pathname + location.search;
  const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: back, queryParams: { prompt: 'select_account' } } });
  if (error) throw error;
}

export async function signOut() {
  if (mode === 'local') { try { localStorage.removeItem(LOCAL_KEY); } catch {} listener(null, 'SIGNED_OUT'); return; }
  if (client) await client.auth.signOut();
}
