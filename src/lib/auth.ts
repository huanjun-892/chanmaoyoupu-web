// ==================== 认证模块 ====================
// 客户端认证相关功能：登录/注册/收藏/点赞等

const API_BASE = 'https://api.chanmaoyoupu.com';

// ==================== 类型定义 ====================
export interface User {
  id?: number;
  nickname?: string;
  email?: string;
  avatar?: string;
  bio?: string;
  token?: string;
}

export interface FavoritesResponse {
  success: boolean;
  data?: any[];
  message?: string;
}

export interface RankingItem {
  slug: string;
  title: string;
  count: number;
  cover?: string;
}

// ==================== Token 管理 ====================
const TOKEN_KEY = 'cmp_token';
const USER_KEY = 'cmp_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredUser(user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function getCurrentUser(): User | null {
  return getStoredUser();
}

// ==================== 认证回调 ====================
type AuthChangeCallback = (user: User | null) => void;
let authChangeCallbacks: AuthChangeCallback[] = [];

export function onAuthChange(callback: AuthChangeCallback): () => void {
  authChangeCallbacks.push(callback);
  return () => {
    authChangeCallbacks = authChangeCallbacks.filter(cb => cb !== callback);
  };
}

function notifyAuthChange(user: User | null): void {
  authChangeCallbacks.forEach(cb => cb(user));
}

// ==================== 登录/注册 ====================
export async function login(email: string, password: string): Promise<{ success: boolean; data?: User; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.success && data.data?.token) {
      setToken(data.data.token);
      setStoredUser(data.data);
      notifyAuthChange(data.data);
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function register(nickname: string, email: string, password: string): Promise<{ success: boolean; data?: User; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, email, password }),
    });
    const data = await res.json();
    if (data.success && data.data?.token) {
      setToken(data.data.token);
      setStoredUser(data.data);
      notifyAuthChange(data.data);
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function checkNickname(nickname: string): Promise<{ success: boolean; available?: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/check-nickname?nickname=${encodeURIComponent(nickname)}`);
    return await res.json();
  } catch {
    return { success: false };
  }
}

export async function oauthLogin(provider: string, code: string): Promise<{ success: boolean; data?: User; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/oauth/${provider}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (data.success && data.data?.token) {
      setToken(data.data.token);
      setStoredUser(data.data);
      notifyAuthChange(data.data);
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function logout(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyAuthChange(null);
}

// ==================== 个人资料 ====================
export async function updateProfile(updates: Partial<User>): Promise<{ success: boolean; data?: User; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录' };
  try {
    const res = await fetch(`${API_BASE}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.success && data.data) {
      const current = getStoredUser();
      setStoredUser({ ...current, ...data.data });
      notifyAuthChange(getStoredUser());
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录' };
  try {
    const res = await fetch(`${API_BASE}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==================== 点赞/收藏 ====================
export async function getLikeStatus(slug: string): Promise<{ liked: boolean }> {
  const token = getToken();
  if (!token) return { liked: false };
  try {
    const res = await fetch(`${API_BASE}/api/user/likes/${slug}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    return { liked: data.liked || false };
  } catch {
    return { liked: false };
  }
}

export async function getFavoriteStatus(slug: string): Promise<{ favorited: boolean }> {
  const token = getToken();
  if (!token) return { favorited: false };
  try {
    const res = await fetch(`${API_BASE}/api/user/favorites/${slug}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    return { favorited: data.favorited || false };
  } catch {
    return { favorited: false };
  }
}

export async function toggleFavorite(slug: string): Promise<FavoritesResponse> {
  const token = getToken();
  if (!token) return { success: false, message: '未登录' };
  try {
    const res = await fetch(`${API_BASE}/api/user/favorites/${slug}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function getMyFavorites(): Promise<FavoritesResponse> {
  const token = getToken();
  if (!token) return { success: false, message: '未登录' };
  try {
    const res = await fetch(`${API_BASE}/api/user/favorites`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// ==================== 排行榜 ====================
export async function getLikesRanking(): Promise<{ success: boolean; data?: RankingItem[] }> {
  try {
    const res = await fetch(`${API_BASE}/api/content/rankings/likes`);
    return await res.json();
  } catch {
    return { success: false };
  }
}

export async function getFavoritesRanking(): Promise<{ success: boolean; data?: RankingItem[] }> {
  try {
    const res = await fetch(`${API_BASE}/api/content/rankings/favorites`);
    return await res.json();
  } catch {
    return { success: false };
  }
}
