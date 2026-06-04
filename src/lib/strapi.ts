import fallbackDataRaw from '../data/strapi-fallback.json';

// ==================== 数据源配置 ====================
// 优先级：Workers Content API > Strapi Cloud > 本地fallback
const CONTENT_API_BASE = 'https://api.chanmaoyoupu.com';
const STRAPI_BASE = 'https://inspired-freedom-62e32d3a2b.strapiapp.com';

// Load fallback data via Vite JSON import
const fallback = (fallbackDataRaw as any).default || fallbackDataRaw;
const fallbackKnowledge: any[] = fallback.knowledge || [];
const fallbackRecipes: any[] = fallback.recipes || [];
const fallbackCuisines: any[] = fallback.cuisines || [];
const fallbackTags: any[] = fallback.tags || [];

// ==================== Workers Content API ====================
async function fetchContentAPI(path: string): Promise<any> {
  const url = new URL(path, CONTENT_API_BASE);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn('Content API ' + path + ' returned ' + res.status);
      return null;
    }
    const data = await res.json();
    if (data && data.success && data.data) return data.data;
    return null;
  } catch (err: any) {
    console.warn('Content API ' + path + ' error: ' + err.message);
    return null;
  }
}

// ==================== Strapi Cloud API ====================
export async function fetchAPI(path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL('/api' + path, STRAPI_BASE);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const maxRetries = 2;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeout);
      if (!res.ok) {
        console.warn('Strapi API ' + path + ' returned ' + res.status);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return null;
      }
      return await res.json();
    } catch (err: any) {
      console.warn('Strapi API ' + path + ' error: ' + err.message);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return null;
    }
  }
  return null;
}

export function getCoverUrl(cover: any): string | null {
  if (!cover) return null;
  if (cover.formats?.small?.url) return cover.formats.small.url;
  if (cover.url) return cover.url;
  return null;
}

export function getCoverFullUrl(cover: any): string | null {
  if (!cover) return null;
  if (cover.url) return cover.url;
  return null;
}

export function processContent(content: string): string {
  if (!content) return '<p>暂无内容</p>';
  let html = content;
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^---$/gm, '<hr>');
  return html;
}

function getFallbackKnowledge(): any[] {
  return fallbackKnowledge.filter((e: any) => e.category !== 'secret');
}

function getFallbackSecrets(): any[] {
  return fallbackKnowledge.filter((e: any) => e.category === 'secret');
}

// ==================== 食谱 ====================
export async function getAllRecipes() {
  const contentData = await fetchContentAPI('/api/content/recipes');
  if (contentData && contentData.length > 0) return contentData;
  const data = await fetchAPI('/recipes', {
    'pagination[pageSize]': '100',
    'populate[cuisine]': 'true',
    'populate[methods]': 'true',
    'populate[tags]': 'true',
    'populate[regions]': 'true',
    'populate[ingredients]': 'true',
    'populate[steps]': 'true',
    'populate[cover]': 'true',
  });
  const items = data?.data || [];
  if (items.length > 0) return items;
  console.warn('All APIs returned no recipes, using fallback data');
  return fallbackRecipes;
}

export async function getRecipeBySlug(slug: string) {
  const contentData = await fetchContentAPI('/api/content/recipes/' + slug);
  if (contentData) return contentData;
  const data = await fetchAPI('/recipes', {
    'filters[slug][$eq]': slug,
    'populate[cuisine]': 'true',
    'populate[methods]': 'true',
    'populate[tags]': 'true',
    'populate[regions]': 'true',
    'populate[ingredients]': 'true',
    'populate[steps]': 'true',
    'populate[cover]': 'true',
    'populate[relatedRecipes]': 'true',
    'populate[relatedKnowledge]': 'true',
  });
  const item = data?.data?.[0] || null;
  if (item) return item;
  const fallbackRecipe = fallbackRecipes.find((r: any) => r.slug === slug);
  if (fallbackRecipe) {
    console.warn('Using fallback for recipe: ' + slug);
    return fallbackRecipe;
  }
  return null;
}

// ==================== 菜系 ====================
export async function getAllCuisines() {
  const contentData = await fetchContentAPI('/api/content/cuisines');
  if (contentData && contentData.length > 0) return contentData;
  const data = await fetchAPI('/cuisines', {
    'pagination[pageSize]': '100',
    'populate[cover]': 'true',
  });
  const items = data?.data || [];
  if (items.length > 0) return items;
  console.warn('All APIs returned no cuisines, using fallback data');
  return fallbackCuisines;
}

// ==================== 标签 ====================
export async function getAllTags() {
  const contentData = await fetchContentAPI('/api/content/tags');
  if (contentData && contentData.length > 0) return contentData;
  const data = await fetchAPI('/tags', { 'pagination[pageSize]': '100' });
  const items = data?.data || [];
  if (items.length > 0) return items;
  console.warn('All APIs returned no tags, using fallback data');
  return fallbackTags;
}

// ==================== 知识库 ====================
export async function getAllKnowledge() {
  const contentData = await fetchContentAPI('/api/content/knowledge');
  if (contentData && contentData.length > 0) {
    return contentData;
  }
  const data = await fetchAPI('/knowledge-entries', {
    'pagination[pageSize]': '100',
    'populate[relatedRecipes]': 'true',
    'populate[relatedKnowledge]': 'true',
  });
  const items = data?.data || [];
  if (items.length > 0) return items;
  console.warn('All APIs returned no knowledge entries, using fallback data');
  return getFallbackKnowledge();
}

// ==================== 秘方 ====================
export async function getAllSecrets() {
  const contentData = await fetchContentAPI('/api/content/secrets');
  if (contentData && contentData.length > 0) return contentData;
  const data = await fetchAPI('/knowledge-entries', {
    'pagination[pageSize]': '100',
    'filters[category][$eq]': 'secret',
    'populate[relatedRecipes]': 'true',
    'populate[relatedKnowledge]': 'true',
  });
  const items = data?.data || [];
  if (items.length > 0) return items;
  console.warn('All APIs returned no secrets, using fallback data');
  return getFallbackSecrets();
}

// ==================== 辅助函数 ====================
export async function getAllRegions() {
  const contentData = await fetchContentAPI('/api/content/regions');
  if (contentData && contentData.length > 0) return contentData;
  const data = await fetchAPI('/regions', { 'pagination[pageSize]': '100' });
  return data?.data || [];
}

export async function getAllMethods() {
  const contentData = await fetchContentAPI('/api/content/methods');
  if (contentData && contentData.length > 0) return contentData;
  const data = await fetchAPI('/methods', { 'pagination[pageSize]': '100' });
  return data?.data || [];
}



export function difficultyLabel(d: string): string {
  const map: Record<string, string> = { easy: '入门', simple: '简单', medium: '中级', hard: '高级' };
  return map[d] || d;
}

export function difficultyColor(d: string): string {
  const map: Record<string, string> = { easy: '#5CB85C', simple: '#5CB85C', medium: '#FF8C42', hard: '#E57373' };
  return map[d] || '#9A9A9A';
}

// ==================== 食材调料 ====================
export async function getAllIngredients(category?: string) {
  const params: Record<string, string> = {};
  if (category) params['category'] = category;
  const contentData = await fetchContentAPI('/api/content/ingredients' + (category ? '?category=' + category : ''));
  if (contentData && contentData.length > 0) return contentData;
  return [];
}

export async function getIngredientBySlug(slug: string) {
  const contentData = await fetchContentAPI('/api/content/ingredients/' + slug);
  if (contentData) return contentData;
  return null;
}

// ==================== 全站搜索 ====================
export async function searchAll(query: string, type: string = 'all') {
  const contentData = await fetchContentAPI(`/api/content/search?q=${encodeURIComponent(query)}&type=${type}`);
  if (contentData) {
    const data = contentData.data || contentData;
    return {
      recipes: data.recipes || [],
      knowledge: data.knowledge || [],
      secrets: data.secrets || [],
      ingredients: data.ingredients || [],
      total: data.total || 0,
    };
  }
  return { recipes: [], knowledge: [], secrets: [], ingredients: [], total: 0 };
}
