/**
 * 馋猫有谱 - 认证工具函数
 */

// API基础URL
const API_BASE = typeof window !== 'undefined' 
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
      ? 'http://localhost:8787' 
      : 'https://api.chanmaoyoupu.com')
  : 'https://api.chanmaoyoupu.com';

// Token存储键
const TOKEN_KEY = 'chanmaoyoupu_token';
const USER_KEY = 'chanmaoyoupu_user';

// 类型定义
export interface User {
  id: number;
  email: string;
  nickname: string;
  avatar_url: string;
  phone: string;
  birthday: string;
  created_at?: string;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    user: User;
    token: string;
  };
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 获取存储的token
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

// 获取存储的用户信息
export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// 检查是否已登录
export function isLoggedIn(): boolean {
  return !!getToken();
}

// 保存认证信息
function saveAuth(token: string, user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// 清除认证信息
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// 获取认证头
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// API请求封装
async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
    });
    return await response.json();
  } catch (error: any) {
    console.error('API请求失败:', error);
    return { success: false, error: error.message || '网络请求失败' };
  }
}

// 检查昵称是否可用
export async function checkNickname(nickname: string): Promise<ApiResponse<{ available: boolean }>> {
  return await apiRequest<{ available: boolean }>(`${API_BASE}/api/auth/check-nickname?nickname=${encodeURIComponent(nickname)}`);
}

// 注册
export async function register(email: string, password: string, nickname?: string, phone?: string, birthday?: string): Promise<AuthResponse> {
  const body: any = { email, password };
  if (nickname) body.nickname = nickname;
  if (phone) body.phone = phone;
  if (birthday) body.birthday = birthday;
  
  const response = await apiRequest<{ user: User; token: string }>(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  
  if (response.success && response.data) {
    saveAuth(response.data.token, response.data.user);
  }
  
  return response as AuthResponse;
}

// 登录
export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await apiRequest<{ user: User; token: string }>(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  
  if (response.success && response.data) {
    saveAuth(response.data.token, response.data.user);
  }
  
  return response as AuthResponse;
}

// 获取当前用户信息
export async function getCurrentUser(): Promise<ApiResponse<User>> {
  return await apiRequest<User>(`${API_BASE}/api/auth/me`);
}

// 更新用户信息
export async function updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
  const response = await apiRequest<User>(`${API_BASE}/api/auth/profile`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  
  if (response.success && response.data) {
    saveAuth(getToken()!, response.data);
  }
  
  return response;
}

// 登出
export function logout(): void {
  clearAuth();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth_change'));
  }
}

// 点赞操作
export async function toggleLike(slug: string): Promise<ApiResponse<{ liked: boolean; count: number }>> {
  return await apiRequest<{ liked: boolean; count: number }>(`${API_BASE}/api/recipes/${encodeURIComponent(slug)}/like`, {
    method: 'POST',
  });
}

// 获取点赞状态和数量
export async function getLikeStatus(slug: string): Promise<ApiResponse<{ liked: boolean; count: number }>> {
  return await apiRequest<{ liked: boolean; count: number }>(`${API_BASE}/api/recipes/${encodeURIComponent(slug)}/likes`);
}

// 收藏操作
export async function toggleFavorite(slug: string): Promise<ApiResponse<{ favorited: boolean; count: number }>> {
  return await apiRequest<{ favorited: boolean; count: number }>(`${API_BASE}/api/recipes/${encodeURIComponent(slug)}/favorite`, {
    method: 'POST',
  });
}

// 获取收藏状态和数量
export async function getFavoriteStatus(slug: string): Promise<ApiResponse<{ favorited: boolean; count: number }>> {
  return await apiRequest<{ favorited: boolean; count: number }>(`${API_BASE}/api/recipes/${encodeURIComponent(slug)}/favorites`);
}

// 获取我的收藏列表
export interface FavoriteItem {
  recipe_slug: string;
  created_at: string;
}

export interface FavoritesResponse {
  items: FavoriteItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export async function getMyFavorites(page: number = 1, limit: number = 10): Promise<ApiResponse<FavoritesResponse>> {
  return await apiRequest<FavoritesResponse>(`${API_BASE}/api/users/me/favorites?page=${page}&limit=${limit}`);
}

// 排行榜
export interface RankingItem {
  recipe_slug: string;
  like_count?: number;
  favorite_count?: number;
}

export async function getLikesRanking(limit: number = 20): Promise<ApiResponse<RankingItem[]>> {
  return await apiRequest<RankingItem[]>(`${API_BASE}/api/rankings/likes?limit=${limit}`);
}

export async function getFavoritesRanking(limit: number = 20): Promise<ApiResponse<RankingItem[]>> {
  return await apiRequest<RankingItem[]>(`${API_BASE}/api/rankings/favorites?limit=${limit}`);
}

// OAuth预留接口
export async function oauthLogin(provider: 'wechat' | 'douyin' | 'kuaishou'): Promise<ApiResponse<{ provider: string; status: string }>> {
  return await apiRequest<{ provider: string; status: string }>(`${API_BASE}/api/oauth/${provider}`, {
    method: 'POST',
  });
}

// 监听认证状态变化
export function onAuthChange(callback: (isLoggedIn: boolean, user: User | null) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handler = () => {
    callback(isLoggedIn(), getStoredUser());
  };
  
  window.addEventListener('auth_change', handler);
  window.addEventListener('storage', handler);
  
  return () => {
    window.removeEventListener('auth_change', handler);
    window.removeEventListener('storage', handler);
  };
}
