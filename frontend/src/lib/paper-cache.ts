import { type Paper } from "./mock-data";
import { type Ranked } from "./rank";
import { MOCK_PAPERS } from "./mock-data";

// Keep a map in memory during the session as well
const memoryCache: Record<string, Paper> = {};
for (const p of MOCK_PAPERS) {
  memoryCache[p.id] = p;
}

export function cachePapers(papers: (Paper | Ranked)[]) {
  try {
    for (const p of papers) {
      memoryCache[p.id] = p;
    }
    const existingStr = localStorage.getItem("arclight-paper-cache");
    const existing: Record<string, Paper> = existingStr ? JSON.parse(existingStr) : {};
    for (const p of papers) {
      existing[p.id] = p;
    }
    localStorage.setItem("arclight-paper-cache", JSON.stringify(existing));
  } catch (err) {
    console.warn("Failed to cache papers", err);
  }
}

export function getCachedPapers(ids: string[]): Paper[] {
  try {
    const existingStr = localStorage.getItem("arclight-paper-cache");
    const existing: Record<string, Paper> = existingStr ? JSON.parse(existingStr) : {};
    
    return ids.map((id) => {
      return memoryCache[id] || existing[id] || MOCK_PAPERS.find(p => p.id === id);
    }).filter(Boolean) as Paper[];
  } catch (err) {
    console.warn("Failed to read paper cache", err);
    return ids.map(id => memoryCache[id] || MOCK_PAPERS.find(p => p.id === id)).filter(Boolean) as Paper[];
  }
}

export function searchCachedPapers(query: string, excludeIds: string[] = []): Paper[] {
  try {
    const existingStr = localStorage.getItem("arclight-paper-cache");
    const existing: Record<string, Paper> = existingStr ? JSON.parse(existingStr) : {};
    
    // Combine mock papers and cached papers
    const allPapers = { ...existing };
    for (const p of MOCK_PAPERS) {
      if (!allPapers[p.id]) allPapers[p.id] = p;
    }
    for (const p of Object.values(memoryCache)) {
      if (!allPapers[p.id]) allPapers[p.id] = p;
    }

    const available = Object.values(allPapers).filter(p => !excludeIds.includes(p.id));
    const needle = query.toLowerCase().trim();
    
    if (!needle) return available.slice(0, 20);
    
    return available
      .filter((p) => 
        p.title.toLowerCase().includes(needle) || 
        p.abstract.toLowerCase().includes(needle) ||
        p.tags?.some(t => t.toLowerCase().includes(needle))
      )
      .slice(0, 20);
  } catch {
    return MOCK_PAPERS.filter(p => !excludeIds.includes(p.id)).slice(0, 20);
  }
}
