import fs from 'fs';
import path from 'path';

const STRAPI_BASE = 'https://inspired-freedom-62e32d3a2b.strapiapp.com';
const CACHE_DIR = 'node_modules/.strapi-cache';

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCached(key: string): any | null {
  try {
    const fpath = path.join(CACHE_DIR, `${key}.json`);
    if (fs.existsSync(fpath)) {
      return JSON.parse(fs.readFileSync(fpath, 'utf-8'));
    }
  } catch {}
  return null;
}

function setCache(key: string, data: any) {
  try {
    ensureCacheDir();
    const fpath = path.join(CACHE_DIR, `${key}.json`);
    fs.writeFileSync(fpath, JSON.stringify(data), 'utf-8');
  } catch {}
}

export async function fetchAPI(path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`/api${path}`, STRAPI_BASE);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const cacheKey = path.replace(/[^a-zA-Z0-9]/g, '_');
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeout);
      
      if (!res.ok) {
        console.error(`Strapi API ${path} returned ${res.status}, attempt ${attempt}/${maxRetries}`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
          continue;
        }
        // API failed, try cache
        const cached = getCached(cacheKey);
        if (cached) {
          console.warn(`Strapi API ${path} failed, using cached data`);
          return cached;
        }
        return null;
      }
      
      const data = await res.json();
      // Save to cache on success
      if (data?.data) {
        setCache(cacheKey, data);
      }
      return data;
    } catch (err: any) {
      console.error(`Strapi API ${path} fetch error (attempt ${attempt}/${maxRetries}): ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      // Network error, try cache
      const cached = getCached(cacheKey);
      if (cached) {
        console.warn(`Strapi API ${path} failed, using cached data`);
        return cached;
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

/**
 * Process content that may contain markdown artifacts
 * Converts **bold** to <strong>, *italic* to <em>, etc.
 */
export function processContent(content: string): string {
  if (!content) return '<p>暂无内容</p>';
  
  let html = content;
  
  // Convert **bold** to <strong>bold</strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Convert *italic* to <em>italic</em>
  html = html.replace(/(?<![>\w*])\*(?!\*)(.+?)(?<!\*)\*(?![<\w*])/g, '<em>$1</em>');
  
  // Convert ### headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  
  // Convert - list items to <li>
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  
  // Convert numbered list items
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // Convert --- to <hr>
  html = html.replace(/^---$/gm, '<hr>');
  
  return html;
}

export async function getAllRecipes() {
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
  return data?.data || [];
}

export async function getRecipeBySlug(slug: string) {
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
  return data?.data?.[0] || null;
}

export async function getAllCuisines() {
  const data = await fetchAPI('/cuisines', {
    'pagination[pageSize]': '100',
    'populate[cover]': 'true',
  });
  return data?.data || [];
}

export async function getAllRegions() {
  const data = await fetchAPI('/regions', { 'pagination[pageSize]': '100' });
  return data?.data || [];
}

export async function getAllMethods() {
  const data = await fetchAPI('/methods', { 'pagination[pageSize]': '100' });
  return data?.data || [];
}

export async function getAllTags() {
  const data = await fetchAPI('/tags', { 'pagination[pageSize]': '100' });
  return data?.data || [];
}

export async function getAllIngredients() {
  const data = await fetchAPI('/ingredients', { 'pagination[pageSize]': '100' });
  return data?.data || [];
}

export async function getAllKnowledge() {
  const data = await fetchAPI('/knowledge-entries', {
    'pagination[pageSize]': '100',
    'populate[relatedRecipes]': 'true',
    'populate[relatedKnowledge]': 'true',
  });
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
