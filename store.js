// Penyimpanan akun, poin & peringkat.
//  - Mode "supabase": login Google lewat Supabase Auth, data di Postgres (lihat supabase/schema.sql).
//    Server memakai SECRET key (service_role) → browser tidak pernah bisa menulis poin.
//  - Mode "local": dipakai otomatis bila env Supabase tidak diisi (pengembangan / tes).
//    Akun dibuat per perangkat (token acak di localStorage), data disimpan ke file JSON.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SCORING = require('./scoring');
const MISSIONS = require('./missions');

const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class StoreError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

function validateUsername(u) {
  u = String(u || '').trim();
  if (!USERNAME_RE.test(u)) throw new StoreError('username_invalid', 'Username 3–16 karakter: huruf, angka, atau _');
  return u;
}

const pub = p => p && ({
  publicId: p.public_id, username: p.username, avatarUrl: p.avatar_url || null,
  points: Number(p.points) || 0, games: p.games || 0, wins: p.wins || 0, unmasks: p.unmasks || 0,
  tier: SCORING.tierOf(Number(p.points) || 0),
  title: MISSIONS.titleOf(p.title && p.progress?.done?.[p.title] ? p.title : null),
  titles: Object.keys(p.progress?.done || {}).length,
});

// Peringkat kompetisi standar: seri poin dipecah kemenangan, seri penuh = peringkat sama.
function withRanks(rows) {
  let prev = null, rank = 0;
  return rows.map((r, i) => {
    if (!prev || r.points !== prev.points || r.wins !== prev.wins) rank = i + 1;
    prev = r;
    return { rank, ...r };
  });
}

// --------------------------------------------------------------- Supabase --
class SupabaseStore {
  constructor(url, secretKey, publishableKey) {
    const { createClient } = require('@supabase/supabase-js');
    this.mode = 'supabase';
    this.url = url; this.publishableKey = publishableKey;
    this.db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  clientConfig() { return { mode: this.mode, supabaseUrl: this.url, supabaseKey: this.publishableKey }; }

  async identify(token) {
    if (!token || typeof token !== 'string' || token.length > 4096) return null;
    const { data, error } = await this.db.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    const c = data.claims, meta = c.user_metadata || {};
    if (c.is_anonymous) return null;
    return { uid: c.sub, email: c.email || null, displayName: meta.full_name || meta.name || null, avatarUrl: meta.avatar_url || meta.picture || null };
  }

  async getProfile(uid) {
    const { data, error } = await this.db.from('profiles').select('*').eq('user_id', uid).maybeSingle();
    if (error) throw error;
    return data;
  }

  async usernameAvailable(username) {
    const { count, error } = await this.db.from('profiles').select('user_id', { count: 'exact', head: true }).ilike('username', username.replace(/[_%\\]/g, '\\$&'));
    if (error) throw error;
    return !count;
  }

  async createProfile(uid, username, avatarUrl) {
    username = validateUsername(username);
    const { data, error } = await this.db.rpc('create_profile', { p_user_id: uid, p_username: username, p_avatar_url: avatarUrl || null });
    if (error) {
      if (/username_taken/.test(error.message)) throw new StoreError('username_taken', 'Username sudah dipakai');
      if (/profile_exists/.test(error.message)) return this.getProfile(uid);
      throw error;
    }
    return data;
  }

  async renameProfile(uid, username) {
    username = validateUsername(username);
    const { data, error } = await this.db.from('profiles').update({ username, updated_at: new Date().toISOString() }).eq('user_id', uid).select().single();
    if (error) {
      if (error.code === '23505') throw new StoreError('username_taken', 'Username sudah dipakai');
      throw error;
    }
    return data;
  }

  async touchAvatar(uid, avatarUrl) {
    if (avatarUrl) await this.db.from('profiles').update({ avatar_url: avatarUrl }).eq('user_id', uid);
  }

  async awardMatch(code, n, results) {
    const { error } = await this.db.rpc('award_match', {
      p_room_code: code, p_player_count: n,
      p_results: results.map(r => ({ user_id: r.uid, placement: r.placement, points: r.points, unmasks: r.unmasks })),
    });
    if (error) throw error;
  }

  async saveProgress(uid, progress) {
    const { error } = await this.db.from('profiles').update({ progress, updated_at: new Date().toISOString() }).eq('user_id', uid);
    if (error) throw error;
  }
  async setTitle(uid, key) {
    const { data, error } = await this.db.from('profiles').update({ title: key }).eq('user_id', uid).select().single();
    if (error) throw error;
    return data;
  }

  async leaderboard(limit = 50) {
    const { data, error } = await this.db.from('profiles')
      .select('public_id, username, avatar_url, points, games, wins, unmasks, title, progress')
      .gt('games', 0)
      .order('points', { ascending: false }).order('wins', { ascending: false }).order('games', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data;
  }

  async rank(uid) {
    const { data, error } = await this.db.rpc('player_rank', { p_user_id: uid });
    if (error) throw error;
    return Number(data);
  }

  async byPublicId(publicId) {
    const { data, error } = await this.db.from('profiles').select('*').eq('public_id', publicId).maybeSingle();
    if (error) throw error;
    return data;
  }

  async recent(uid, limit = 8) {
    const { data, error } = await this.db.from('match_players')
      .select('placement, points, unmasks, match_id, matches(player_count, created_at)')
      .eq('user_id', uid).order('match_id', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []).map(r => ({ placement: r.placement, points: r.points, unmasks: r.unmasks, players: r.matches?.player_count, at: r.matches?.created_at }));
  }
}

// ------------------------------------------------------------------ Local --
class LocalStore {
  constructor(file) {
    this.mode = 'local';
    this.file = file;
    this.data = { profiles: {}, matches: [] };
    try { this.data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* file baru */ }
    this.data.profiles ||= {}; this.data.matches ||= [];
  }
  clientConfig() { return { mode: this.mode }; }
  save() {
    clearTimeout(this.t);
    this.t = setTimeout(() => {
      try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.data)); }
      catch (e) { console.error('local store', e.message); }
    }, 200);
  }
  async identify(token) {
    if (typeof token !== 'string' || !/^local_[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
    const uid = 'local-' + crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
    return { uid, email: null, displayName: null, avatarUrl: null };
  }
  async getProfile(uid) { return this.data.profiles[uid] || null; }
  async usernameAvailable(u) { return !Object.values(this.data.profiles).some(p => p.username.toLowerCase() === u.toLowerCase()); }
  async createProfile(uid, username, avatarUrl) {
    username = validateUsername(username);
    if (this.data.profiles[uid]) return this.data.profiles[uid];
    if (!(await this.usernameAvailable(username))) throw new StoreError('username_taken', 'Username sudah dipakai');
    const taken = new Set(Object.values(this.data.profiles).map(p => p.public_id));
    let id;
    do { id = Array.from({ length: 5 }, () => ID_ALPHABET[crypto.randomInt(ID_ALPHABET.length)]).join(''); } while (taken.has(id));
    const p = { user_id: uid, public_id: id, username, avatar_url: avatarUrl || null, points: 0, games: 0, wins: 0, unmasks: 0, created_at: new Date().toISOString() };
    this.data.profiles[uid] = p; this.save();
    return p;
  }
  async renameProfile(uid, username) {
    username = validateUsername(username);
    const p = this.data.profiles[uid];
    if (!p) throw new StoreError('no_profile', 'Profil belum dibuat');
    if (p.username.toLowerCase() !== username.toLowerCase() && !(await this.usernameAvailable(username))) throw new StoreError('username_taken', 'Username sudah dipakai');
    p.username = username; this.save();
    return p;
  }
  async touchAvatar() {}
  async saveProgress(uid, progress) { const p = this.data.profiles[uid]; if (p) { p.progress = progress; this.save(); } }
  async setTitle(uid, key) { const p = this.data.profiles[uid]; if (p) { p.title = key; this.save(); } return p; }
  async awardMatch(code, n, results) {
    const id = this.data.matches.length + 1;
    const at = new Date().toISOString();
    for (const r of results) {
      const p = this.data.profiles[r.uid]; if (!p) continue;
      p.points += r.points; p.games += 1; p.wins += r.placement === 1 ? 1 : 0; p.unmasks += r.unmasks;
      (p.recent ||= []).unshift({ placement: r.placement, points: r.points, unmasks: r.unmasks, players: n, at });
      p.recent.length = Math.min(p.recent.length, 8);
    }
    this.data.matches.push({ id, code, n, at });
    if (this.data.matches.length > 500) this.data.matches.shift();
    this.save();
  }
  _sorted() { return Object.values(this.data.profiles).sort((a, b) => b.points - a.points || b.wins - a.wins || a.games - b.games); }
  async leaderboard(limit = 50) { return this._sorted().filter(p => p.games > 0).slice(0, limit); }
  async rank(uid) {
    const me = this.data.profiles[uid]; if (!me) return null;
    return 1 + Object.values(this.data.profiles).filter(o => o.games > 0 && o.points > me.points || (o.games > 0 && o.points === me.points && o.wins > me.wins)).length;
  }
  async byPublicId(id) { return Object.values(this.data.profiles).find(p => p.public_id === id) || null; }
  async recent(uid) { return this.data.profiles[uid]?.recent || []; }
}

function createStore(env = process.env) {
  const url = env.SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const publishable = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (url && secret && publishable) return new SupabaseStore(url, secret, publishable);
  if (url || secret || publishable) console.warn('[store] Env Supabase tidak lengkap — memakai mode lokal. Perlu SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY.');
  return new LocalStore(env.LOCAL_STORE_FILE || path.join(__dirname, 'data', 'local-store.json'));
}

module.exports = { createStore, StoreError, pub, withRanks, validateUsername, USERNAME_RE };
