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
const fallbackRegions: any[] = fallback.regions || [];
const fallbackMethods: any[] = fallback.methods || [];
const fallbackIngredients: any[] = fallback.ingredients || [];

// ==================== 数据格式统一 ====================
// Strapi v4 返回嵌套格式 { id, attributes: {...} }，Content API 返回扁平格式
// 统一转换为扁平格式，与 Content API 保持一致
function flattenStrapiItem(item: any): any {
  if (!item) return null;
  // 如果已经是扁平格式（没有 attributes 字段），直接返回
  if (!item.attributes) return item;
  
  const flat: any = { id: item.id };
  const attrs = item.attributes;
  
  for (const key of Object.keys(attrs)) {
    const value = attrs[key];
    // 处理关系数据：toOne 关系 { data: { id, attributes } }
    if (value && value.data && !Array.isArray(value.data)) {
      flat[key] = flattenStrapiItem(value.data);
    }
    // 处理关系数据：toMany 关系 { data: [{ id, attributes }, ...] }
    else if (value && value.data && Array.isArray(value.data)) {
      flat[key] = value.data.map((d: any) => flattenStrapiItem(d));
    }
    // 普通字段
    else {
      flat[key] = value;
    }
  }
  
  return flat;
}

function flattenStrapiList(data: any[] | null | undefined): any[] {
  if (!data || !Array.isArray(data)) return [];
  return data.map(item => flattenStrapiItem(item)).filter(Boolean);
}

// ==================== Workers Content API ====================
async function fetchContentAPI(path: string): Promise<any> {
  const url = new URL(path, CONTENT_API_BASE);
  const maxRetries = 3;
  
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
        console.warn('Content API ' + path + ' returned ' + res.status + ' (attempt ' + attempt + '/' + maxRetries + ')');
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        return null;
      }
      const data = await res.json();
      // 兼容两种格式：直接返回数组 或 { success: true, data: [...] }
      if (Array.isArray(data)) return data;
      if (data && data.success && data.data) return data.data;
      if (data && Array.isArray(data.data)) return data.data;
      return null;
    } catch (err: any) {
      console.warn('Content API ' + path + ' error: ' + err.message + ' (attempt ' + attempt + '/' + maxRetries + ')');
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      return null;
    }
  }
  return null;
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

// ==================== 强制使用Fallback（构建加速） ====================
const FORCE_FALLBACK = true; // 临时启用fallback排查构建问题

// ==================== 食谱 ====================
export async function getAllRecipes() {
  if (FORCE_FALLBACK) return fallbackRecipes;
  const contentData = await fetchContentAPI('/api/content/recipes');
  if (contentData && contentData.length > 0) {
    // 数据清洗：确保必要字段有默认值，避免构建时报错
    return contentData.map(recipe => ({
      ...recipe,
      title: recipe.title || '未命名食谱',
      slug: recipe.slug || '',
      description: recipe.description || '',
      difficulty: recipe.difficulty || '简单',
      cookTime: recipe.cookTime || 0,
      servings: recipe.servings || 1,
      cover: recipe.cover || { url: null, formats: {} },
      steps: Array.isArray(recipe.steps) 
        ? recipe.steps.map((step: any) => ({
            ...step,
            stepNumber: step.stepNumber || 0,
            description: step.description || '',
          }))
        : [],
      ingredients: Array.isArray(recipe.ingredients) 
        ? recipe.ingredients.map((ing: any) => ({
            ...ing,
            name: ing.name || '',
            amount: ing.amount || '',
          }))
        : [],
      cuisine: recipe.cuisine || null,
      tags: Array.isArray(recipe.tags) ? recipe.tags : [],
      methods: Array.isArray(recipe.methods) ? recipe.methods : [],
      regions: Array.isArray(recipe.regions) ? recipe.regions : [],
    }));
  }
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
  const items = flattenStrapiList(data?.data);
  if (items.length > 0) return items;
  console.warn('All APIs returned no recipes, using fallback data');
  return fallbackRecipes;
}

export async function getRecipeBySlug(slug: string) {
  if (FORCE_FALLBACK) {
    const r = fallbackRecipes.find((r: any) => r.slug === slug);
    return r || null;
  }
  const contentData = await fetchContentAPI('/api/content/recipes/' + slug);
  if (contentData) {
    return {
      ...contentData,
      title: contentData.title || '未命名食谱',
      slug: contentData.slug || '',
      description: contentData.description || '',
      difficulty: contentData.difficulty || '简单',
      cookTime: contentData.cookTime || 0,
      servings: contentData.servings || 1,
      cover: contentData.cover || { url: null, formats: {} },
      steps: Array.isArray(contentData.steps)
        ? contentData.steps.map((step: any) => ({
            ...step,
            stepNumber: step.stepNumber || 0,
            description: step.description || '',
          }))
        : [],
      ingredients: Array.isArray(contentData.ingredients)
        ? contentData.ingredients.map((ing: any) => ({
            ...ing,
            name: ing.name || '',
            amount: ing.amount || '',
          }))
        : [],
      cuisine: contentData.cuisine || null,
      tags: Array.isArray(contentData.tags) ? contentData.tags : [],
      methods: Array.isArray(contentData.methods) ? contentData.methods : [],
      regions: Array.isArray(contentData.regions) ? contentData.regions : [],
    };
  }
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
  const item = flattenStrapiItem(data?.data?.[0]);
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
  if (FORCE_FALLBACK) return fallbackCuisines || [];
  const contentData = await fetchContentAPI('/api/content/cuisines');
  if (contentData && contentData.length > 0) return contentData;
  const data = await fetchAPI('/cuisines', {
    'pagination[pageSize]': '100',
    'populate[cover]': 'true',
  });
  const items = flattenStrapiList(data?.data);
  if (items.length > 0) return items;
  console.warn('All APIs returned no cuisines, using fallback data');
  return fallbackCuisines;
}

// ==================== 标签 ====================
export async function getAllTags() {
  if (FORCE_FALLBACK) return fallbackTags || [];
  const contentData = await fetchContentAPI('/api/content/tags');
  if (contentData && contentData.length > 0) return contentData;
  const data = await fetchAPI('/tags', { 'pagination[pageSize]': '100' });
  const items = flattenStrapiList(data?.data);
  if (items.length > 0) return items;
  console.warn('All APIs returned no tags, using fallback data');
  return fallbackTags;
}

// ==================== 知识库 ====================
export async function getAllKnowledge() {
  if (FORCE_FALLBACK) return getFallbackKnowledge();
  const contentData = await fetchContentAPI('/api/content/knowledge');
  if (contentData && contentData.length > 0) {
    return contentData;
  }
  const data = await fetchAPI('/knowledge-entries', {
    'pagination[pageSize]': '100',
    'populate[relatedRecipes]': 'true',
    'populate[relatedKnowledge]': 'true',
  });
  const items = flattenStrapiList(data?.data);
  if (items.length > 0) return items;
  console.warn('All APIs returned no knowledge entries, using fallback data');
  return getFallbackKnowledge();
}

// ==================== 秘方 ====================
export async function getAllSecrets() {
  if (FORCE_FALLBACK) return getFallbackSecrets();
  const contentData = await fetchContentAPI('/api/content/secrets');
  if (contentData && contentData.length > 0) return contentData;
  const data = await fetchAPI('/knowledge-entries', {
    'pagination[pageSize]': '100',
    'filters[category][$eq]': 'secret',
    'populate[relatedRecipes]': 'true',
    'populate[relatedKnowledge]': 'true',
  });
  const items = flattenStrapiList(data?.data);
  if (items.length > 0) return items;
  console.warn('All APIs returned no secrets, using fallback data');
  return getFallbackSecrets();
}

// ==================== 辅助函数 ====================
export async function getAllRegions() {
  if (FORCE_FALLBACK) return fallbackRegions || [];
  const contentData = await fetchContentAPI('/api/content/regions');
  if (contentData && contentData.length > 0) return contentData;
  const data = await fetchAPI('/regions', { 'pagination[pageSize]': '100' });
  return flattenStrapiList(data?.data);
}

export async function getAllMethods() {
  if (FORCE_FALLBACK) return fallbackMethods || [];
  const contentData = await fetchContentAPI('/api/content/methods');
  if (contentData && contentData.length > 0) return contentData;
  const data = await fetchAPI('/methods', { 'pagination[pageSize]': '100' });
  return flattenStrapiList(data?.data);
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
  if (FORCE_FALLBACK) return fallbackIngredients || [];
  const params: Record<string, string> = {};
  if (category) params['category'] = category;
  const contentData = await fetchContentAPI('/api/content/ingredients' + (category ? '?category=' + category : ''));
  if (contentData && contentData.length > 0) return contentData;
  return [];
}

export async function getIngredientBySlug(slug: string) {
  if (FORCE_FALLBACK) {
    const ing = (fallbackIngredients || []).find((i: any) => i.slug === slug);
    return ing || null;
  }
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
