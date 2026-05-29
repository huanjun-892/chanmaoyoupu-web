import fallbackDataRaw from '../data/strapi-fallback.json';

const STRAPI_BASE = 'https://inspired-freedom-62e32d3a2b.strapiapp.com';

// Load fallback data via Vite JSON import (reliable in all build environments)
const fallback = (fallbackDataRaw as any).default || fallbackDataRaw;
const fallbackKnowledge: any[] = fallback.knowledge || [];
const fallbackRecipes: any[] = fallback.recipes || [];
const fallbackCuisines: any[] = fallback.cuisines || [];
const fallbackTags: any[] = fallback.tags || [];

export async function fetchAPI(path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(\`/api\${path}\`, STRAPI_BASE);
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
        console.warn(\`Strapi API \${path} returned \${res.status}\`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return null;
      }
      
      return await res.json();
    } catch (err: any) {
      console.warn(\`Strapi API \${path} error: \${err.message}\`);
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

/**
 * Process content that may contain markdown artifacts
 * Converts **bold** to <strong>, *italic* to <em>, etc.
 */
export function processContent(content: string): string {
  if (!content) return '<p>暂无内容</p>';
  
  let html = content;
  
  // Convert **bold** to <strong>bold</strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
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

// Fallback data helpers
function getFallbackKnowledge(): any[] {
  return fallbackKnowledge.filter((e: any) => e.category !== 'secret');
}

function getFallbackSecrets(): any[] {
  return fallbackKnowledge.filter((e: any) => e.category === 'secret');
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
  const items = data?.data || [];
  if (items.length === 0) {
    console.warn('Strapi returned no recipes, using fallback data');
    return fallbackRecipes;
  }
  return items;
}

export async function getRecipeBySlug(slug: string) {
  // First try fallback
  const fallbackRecipe = fallbackRecipes.find((r: any) => r.slug === slug);
  
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
  if (!item && fallbackRecipe) {
    console.warn(\`Using fallback for recipe: \${slug}\`);
    return fallbackRecipe;
  }
  return item;
}

export async function getAllCuisines() {
  const data = await fetchAPI('/cuisines', {
    'pagination[pageSize]': '100',
    'populate[cover]': 'true',
  });
  const items = data?.data || [];
  if (items.length === 0) {
    console.warn('Strapi returned no cuisines, using fallback data');
    return fallbackCuisines;
  }
  return items;
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
  const items = data?.data || [];
  if (items.length === 0) {
    console.warn('Strapi returned no tags, using fallback data');
    return fallbackTags;
  }
  return items;
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
  const items = data?.data || [];
  if (items.length === 0) {
    console.warn('Strapi returned no knowledge entries, using fallback data');
    return getFallbackKnowledge();
  }
  return items;
}

export async function getAllSecrets() {
  const data = await fetchAPI('/knowledge-entries', {
    'pagination[pageSize]': '100',
    'filters[category][$eq]': 'secret',
    'populate[relatedRecipes]': 'true',
    'populate[relatedKnowledge]': 'true',
  });
  const items = data?.data || [];
  if (items.length === 0) {
    console.warn('Strapi returned no secrets, using fallback data');
    return getFallbackSecrets();
  }
  return items;
}

export function difficultyLabel(d: string): string {
  const map: Record<string, string> = { easy: '入门', simple: '简单', medium: '中级', hard: '高级' };
  return map[d] || d;
}

export function difficultyColor(d: string): string {
  const map: Record<string, string> = { easy: '#5CB85C', simple: '#5CB85C', medium: '#FF8C42', hard: '#E57373' };
  return map[d] || '#9A9A9A';
}
