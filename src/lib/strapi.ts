const STRAPI_URL = 'https://inspired-freedom-62e32d3a2b.strapiapp.com/api';

export async function fetchAPI(path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(path, STRAPI_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      clearTimeout(timeout);
      
      if (!res.ok) {
        console.error(`Strapi API ${path} returned ${res.status}, attempt ${attempt}/${maxRetries}`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
          continue;
        }
        return null;
      }
      
      const data = await res.json();
      return data;
    } catch (err: any) {
      console.error(`Strapi API ${path} fetch error (attempt ${attempt}/${maxRetries}): ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      return null;
    }
  }
  return null;
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
    'populate[relatedRecipes]': 'true',
    'populate[relatedKnowledge]': 'true',
  });
  return data?.data?.[0] || null;
}

export async function getAllCuisines() {
  const data = await fetchAPI('/cuisines', { 'pagination[pageSize]': '100' });
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
  const map: Record<string, string> = {
    easy: '入门',
    simple: '简单',
    medium: '中级',
    hard: '高级',
  };
  return map[d] || d;
}

export function difficultyColor(d: string): string {
  const map: Record<string, string> = {
    easy: '#5CB85C',
    simple: '#5CB85C',
    medium: '#FF8C42',
    hard: '#E57373',
  };
  return map[d] || '#9A9A9A';
}
