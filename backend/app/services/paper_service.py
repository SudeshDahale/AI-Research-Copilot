import asyncio
import html
import re
import xml.etree.ElementTree as ET
import httpx
from app.core.logging import logger

# Set a helpful user agent
HEADERS = {
    "User-Agent": "ArclightResearchCopilot/0.1 (mailto:contact@arclight.edu)"
}

def normalize_title(title: str) -> str:
    """Lowercase and remove non-alphanumeric characters for fuzzy matching."""
    if not title:
        return ""
    return "".join(c for c in title.lower() if c.isalnum())

def clean_text(text: str | None) -> str:
    """Normalize whitespace and unescape XML/HTML entities."""
    if not text:
        return ""
    cleaned = " ".join(text.split())
    return html.unescape(cleaned)

def parse_arxiv_id(id_url: str) -> str:
    """Extract arXiv ID from standard URLs and format as arx-xxxx-xxxx."""
    # e.g., http://arxiv.org/abs/2411.01823v1 -> arx-2411-01823
    part = id_url.split("/abs/")[-1]
    raw_id = part.split("v")[0] # Strip off the version suffix (e.g. v1, v2)
    formatted = raw_id.replace(".", "-").replace("/", "-")
    return f"arx-{formatted}"

async def fetch_arxiv(query: str, limit: int = 30) -> list[dict]:
    """Fetch papers from the arXiv API."""
    url = "https://export.arxiv.org/api/query"
    params = {
        "search_query": f"all:{query}",
        "max_results": limit
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, headers=HEADERS, timeout=10.0)
            if response.status_code != 200:
                logger.warning(f"arXiv API returned status {response.status_code} for query: {query}")
                return []
            xml_content = response.text
    except Exception as e:
        logger.error(f"Error fetching from arXiv: {e}", exc_info=True)
        return []

    try:
        root = ET.fromstring(xml_content)
    except Exception as e:
        logger.error(f"Error parsing arXiv XML: {e}", exc_info=True)
        return []

    ns = {
        "atom": "http://www.w3.org/2005/Atom",
        "arxiv": "http://arxiv.org/schemas/atom"
    }

    papers = []
    for entry in root.findall("atom:entry", ns):
        # 1. ID
        id_elem = entry.find("atom:id", ns)
        id_val = parse_arxiv_id(id_elem.text) if id_elem is not None and id_elem.text else f"arx-{hash(query)}"

        # 2. Title
        title_elem = entry.find("atom:title", ns)
        title = clean_text(title_elem.text) if title_elem is not None and title_elem.text else ""

        # 3. Abstract
        summary_elem = entry.find("atom:summary", ns)
        abstract = clean_text(summary_elem.text) if summary_elem is not None and summary_elem.text else ""

        # 4. Year
        published_elem = entry.find("atom:published", ns)
        year = 2024
        if published_elem is not None and published_elem.text:
            try:
                year = int(published_elem.text.split("-")[0])
            except (ValueError, IndexError):
                pass

        # 5. Authors
        authors = []
        for author in entry.findall("atom:author", ns):
            name_elem = author.find("atom:name", ns)
            if name_elem is not None and name_elem.text:
                authors.append(name_elem.text.strip())

        # 6. DOI
        doi_elem = entry.find("arxiv:doi", ns)
        doi = doi_elem.text.strip() if doi_elem is not None and doi_elem.text else ""

        # 7. Tags/Categories
        tags = []
        for cat in entry.findall("atom:category", ns):
            term = cat.attrib.get("term")
            if term:
                tags.append(term)

        # 8. PDF URL
        pdf_url = ""
        if id_val.startswith("arx-"):
            raw_id = id_val.replace("arx-", "").replace("-", ".")
            pdf_url = f"https://arxiv.org/pdf/{raw_id}.pdf"

        papers.append({
            "id": id_val,
            "title": title,
            "authors": authors,
            "year": year,
            "journal": "arXiv",
            "citations": 0,
            "relevance": 0.0,
            "abstract": abstract,
            "tags": tags,
            "doi": doi,
            "addedAt": "Just now",
            "status": "unread",
            "summary": {
                "objective": "",
                "methodology": "",
                "dataset": "",
                "results": "",
                "limitations": ""
            },
            "gaps": [],
            "future": [],
            "pdf_url": pdf_url
        })

    return papers

async def fetch_semantic_scholar(query: str, limit: int = 30) -> list[dict]:
    """Fetch papers from the Semantic Scholar API."""
    url = "https://api.semanticscholar.org/graph/v1/paper/search"
    params = {
        "query": query,
        "limit": limit,
        "fields": "title,authors,venue,year,citationCount,abstract,externalIds,openAccessPdf"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, headers=HEADERS, timeout=10.0)
            if response.status_code == 429:
                logger.warning("Semantic Scholar API rate limited (429).")
                return []
            if response.status_code != 200:
                logger.warning(f"Semantic Scholar API returned status {response.status_code} for query: {query}")
                return []
            data = response.json()
    except Exception as e:
        logger.error(f"Error fetching from Semantic Scholar: {e}", exc_info=True)
        return []

    papers = []
    for item in data.get("data", []):
        external_ids = item.get("externalIds") or {}
        doi = external_ids.get("DOI") or ""
        arxiv_id = external_ids.get("ArXiv") or ""

        # Format ID: prefer arXiv format if it has ArXiv ID
        if arxiv_id:
            formatted_arxiv = arxiv_id.replace(".", "-").replace("/", "-")
            id_val = f"arx-{formatted_arxiv}"
        else:
            id_val = f"s2-{item.get('paperId')}"

        title = clean_text(item.get("title"))
        abstract = clean_text(item.get("abstract"))
        year = item.get("year") or 2024
        citations = item.get("citationCount") or 0
        journal = clean_text(item.get("venue")) or "Semantic Scholar"

        authors = []
        for author in item.get("authors") or []:
            if author.get("name"):
                authors.append(author["name"].strip())

        open_access = item.get("openAccessPdf") or {}
        pdf_url = open_access.get("url") or ""

        papers.append({
            "id": id_val,
            "title": title,
            "authors": authors,
            "year": year,
            "journal": journal,
            "citations": citations,
            "relevance": 0.0,
            "abstract": abstract,
            "tags": [],
            "doi": doi,
            "addedAt": "Just now",
            "status": "unread",
            "summary": {
                "objective": "",
                "methodology": "",
                "dataset": "",
                "results": "",
                "limitations": ""
            },
            "gaps": [],
            "future": [],
            "pdf_url": pdf_url
        })

    return papers

def merge_papers(p1: dict, p2: dict) -> dict:
    """Merge data from two sources for the same paper, prioritizing higher quality signals."""
    merged = {}
    merged["title"] = p1.get("title") or p2.get("title") or ""
    merged["abstract"] = p1.get("abstract") or p2.get("abstract") or ""
    merged["year"] = p1.get("year") or p2.get("year") or 2024
    
    a1 = p1.get("authors") or []
    a2 = p2.get("authors") or []
    merged["authors"] = a1 if len(a1) >= len(a2) else a2
    
    j1 = p1.get("journal") or ""
    j2 = p2.get("journal") or ""
    if j1.lower() == "arxiv" and j2 and j2.lower() != "arxiv":
        merged["journal"] = j2
    elif j2.lower() == "arxiv" and j1 and j1.lower() != "arxiv":
        merged["journal"] = j1
    else:
        merged["journal"] = j1 or j2 or "arXiv"
        
    c1 = p1.get("citations") or 0
    c2 = p2.get("citations") or 0
    merged["citations"] = max(c1, c2)
    
    t1 = p1.get("tags") or []
    t2 = p2.get("tags") or []
    seen_tags = set()
    merged_tags = []
    for t in t1 + t2:
        if t.lower() not in seen_tags:
            seen_tags.add(t.lower())
            merged_tags.append(t)
    merged["tags"] = merged_tags
    
    merged["doi"] = p1.get("doi") or p2.get("doi") or ""
    
    id1 = p1.get("id") or ""
    id2 = p2.get("id") or ""
    if id1.startswith("arx-"):
        merged["id"] = id1
    elif id2.startswith("arx-"):
        merged["id"] = id2
    else:
        merged["id"] = id1 or id2
        
    merged["addedAt"] = p1.get("addedAt") or p2.get("addedAt") or "Just now"
    merged["status"] = p1.get("status") or p2.get("status") or "unread"
    merged["relevance"] = max(p1.get("relevance", 0.0), p2.get("relevance", 0.0))
    
    merged["summary"] = p1.get("summary") or p2.get("summary") or {
        "objective": "",
        "methodology": "",
        "dataset": "",
        "results": "",
        "limitations": ""
    }
    merged["gaps"] = p1.get("gaps") or p2.get("gaps") or []
    merged["future"] = p1.get("future") or p2.get("future") or []
    merged["pdf_url"] = p1.get("pdf_url") or p2.get("pdf_url") or ""
    
    return merged

def deduplicate_papers(papers: list[dict]) -> list[dict]:
    """Deduplicate papers using DOI, exact ID, or fuzzy title matching."""
    merged_list = []
    for paper in papers:
        match_idx = -1
        for idx, existing in enumerate(merged_list):
            doi1 = paper.get("doi", "").strip().lower()
            doi2 = existing.get("doi", "").strip().lower()
            if doi1 and doi2 and doi1 == doi2:
                match_idx = idx
                break
            
            id1 = paper.get("id", "")
            id2 = existing.get("id", "")
            if id1.startswith("arx-") and id2.startswith("arx-") and id1 == id2:
                match_idx = idx
                break
                
            t1 = normalize_title(paper.get("title", ""))
            t2 = normalize_title(existing.get("title", ""))
            if t1 and t2 and t1 == t2:
                match_idx = idx
                break
                
        if match_idx != -1:
            merged_list[match_idx] = merge_papers(merged_list[match_idx], paper)
        else:
            merged_list.append(paper)
            
    return merged_list

async def search_papers(query: str, limit: int = 30) -> list[dict]:
    """Perform concurrent fetch from arXiv and Semantic Scholar, then merge results."""
    arxiv_task = fetch_arxiv(query, limit)
    s2_task = fetch_semantic_scholar(query, limit)
    
    results = await asyncio.gather(arxiv_task, s2_task, return_exceptions=True)
    
    arxiv_papers = results[0] if not isinstance(results[0], Exception) else []
    s2_papers = results[1] if not isinstance(results[1], Exception) else []
    
    if isinstance(results[0], Exception):
        logger.error(f"arXiv query exception: {results[0]}")
    if isinstance(results[1], Exception):
        logger.error(f"Semantic Scholar query exception: {results[1]}")
        
    all_papers = arxiv_papers + s2_papers
    return deduplicate_papers(all_papers)
