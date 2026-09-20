import asyncio
import html
import re
import uuid
import xml.etree.ElementTree as ET
import httpx
from datetime import datetime
from app.config import settings
from app.core.logging import logger

_CURRENT_YEAR = datetime.now().year

HEADERS = {
    "User-Agent": "ArclightResearchCopilot/1.0 (https://arclight.edu; mailto:contact@arclight.edu)"
}

# Academic expansions that preserve core domain nouns
EXPANSION_RULES = [
    (r"\b(tech\s+diagrams?|technical\s+diagrams?)\b", "technical diagram UML architecture diagram"),
    (r"\b(ai\s+assisted|ai\s+powered|ai\s+driven)\b", "AI automated machine learning"),
    (r"\b(crm\s+systems?|crm)\b", "customer relationship management CRM"),
    (r"\b(ci\s*/?\s*cd|cicd)\b", "continuous integration continuous delivery CI CD"),
    (r"\b(devops)\b", "DevOps software engineering automation"),
    (r"\b(mlops)\b", "MLOps machine learning deployment"),
    (r"\b(nlp)\b", "natural language processing NLP"),
    (r"\b(rag)\b", "retrieval augmented generation RAG"),
    (r"\b(llms?)\b", "large language models LLM"),
    (r"\b(cv)\b", "computer vision"),
    (r"\b(rl)\b", "reinforcement learning"),
    (r"\b(kg)\b", "knowledge graphs"),
    (r"\b(db|dbs)\b", "database systems"),
]


def expand_query(query: str) -> list[str]:
    """Generate academic and conceptual expansions for user queries."""
    if not query:
        return []
    
    variations = [query.strip()]
    lower_q = query.lower()
    
    expanded = lower_q
    modified = False
    for pattern, replacement in EXPANSION_RULES:
        if re.search(pattern, expanded, re.IGNORECASE):
            expanded = re.sub(pattern, replacement, expanded, flags=re.IGNORECASE)
            modified = True
            
    if modified and expanded.strip() != lower_q.strip():
        # Clean up duplicate words in expansion
        words = []
        for w in expanded.split():
            if w not in words:
                words.append(w)
        variations.append(" ".join(words))

    # Add a clean alphanumeric fallback
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", query).strip()
    if cleaned and cleaned.lower() not in [v.lower() for v in variations]:
        variations.append(cleaned)
        
    return variations


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
    part = id_url.split("/abs/")[-1]
    raw_id = part.split("v")[0]  # Strip version suffix (e.g. v1, v2)
    formatted = raw_id.replace(".", "-").replace("/", "-")
    return f"arx-{formatted}"


async def fetch_arxiv(query: str, limit: int = 30, offset: int = 0) -> list[dict]:
    """Fetch papers from the arXiv API with title/abstract scoping and pagination."""
    url = "https://export.arxiv.org/api/query"
    clean_q = re.sub(r'["\'+]', " ", query).strip()
    
    # arXiv search expression
    words = [w for w in clean_q.split() if len(w) > 1]
    if len(words) > 1:
        search_expr = " AND ".join(f"all:{w}" for w in words)
    else:
        search_expr = f"all:{clean_q}" if clean_q else "all:research"

    params = {
        "search_query": search_expr,
        "start": offset,
        "max_results": limit
    }
    
    xml_content = ""
    for attempt in range(2):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, headers=HEADERS, timeout=12.0)
                if response.status_code == 200:
                    xml_content = response.text
                    break
                elif response.status_code == 429 and attempt == 0:
                    logger.warning(f"arXiv rate limited (429), retrying after 1s for: {query}")
                    await asyncio.sleep(1.0)
                    continue
                else:
                    logger.warning(f"arXiv API returned status {response.status_code} for query: {query}")
                    return []
        except httpx.TimeoutException:
            if attempt == 0:
                logger.warning(f"arXiv API timeout on attempt 1 for: {query}, retrying...")
                await asyncio.sleep(1.0)
                continue
            logger.error(f"arXiv API timed out for query: {query}")
            return []
        except Exception as e:
            logger.error(f"Error fetching from arXiv: {e}", exc_info=True)
            return []

    if not xml_content:
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
        id_val = parse_arxiv_id(id_elem.text) if id_elem is not None and id_elem.text else f"arx-{uuid.uuid4().hex[:12]}"

        # 2. Title
        title_elem = entry.find("atom:title", ns)
        title = clean_text(title_elem.text) if title_elem is not None and title_elem.text else ""

        # 3. Abstract
        summary_elem = entry.find("atom:summary", ns)
        abstract = clean_text(summary_elem.text) if summary_elem is not None and summary_elem.text else ""

        # 4. Year
        published_elem = entry.find("atom:published", ns)
        year = _CURRENT_YEAR
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
        if id_elem is not None and id_elem.text and "/abs/" in id_elem.text:
            raw_arxiv_path = id_elem.text.split("/abs/")[-1].split("v")[0]
            pdf_url = f"https://arxiv.org/pdf/{raw_arxiv_path}.pdf"
        elif id_val.startswith("arx-"):
            raw_id = id_val[4:].replace("-", ".")
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


async def fetch_semantic_scholar(query: str, limit: int = 30, offset: int = 0) -> list[dict]:
    """Fetch papers from the Semantic Scholar API with retry, API key, and pagination."""
    url = "https://api.semanticscholar.org/graph/v1/paper/search"
    clean_q = re.sub(r'["\'+]', " ", query).strip()
    params = {
        "query": clean_q,
        "offset": offset,
        "limit": min(limit, 100),
        "fields": "title,authors,venue,year,citationCount,abstract,externalIds,openAccessPdf"
    }
    
    headers = dict(HEADERS)
    if settings.semantic_scholar_api_key:
        headers["x-api-key"] = settings.semantic_scholar_api_key

    data = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, headers=headers, timeout=12.0)
                if response.status_code == 200:
                    data = response.json()
                    break
                elif response.status_code == 429 and attempt == 0:
                    logger.warning("Semantic Scholar API rate limited (429), retrying after 1s...")
                    await asyncio.sleep(1.0)
                    continue
                elif response.status_code == 429:
                    logger.warning("Semantic Scholar API rate limited (429).")
                    return []
                else:
                    logger.warning(f"Semantic Scholar API returned status {response.status_code} for query: {query}")
                    return []
        except httpx.TimeoutException:
            if attempt == 0:
                logger.warning(f"Semantic Scholar timeout on attempt 1 for: {query}, retrying...")
                await asyncio.sleep(1.0)
                continue
            logger.error(f"Semantic Scholar API timed out for query: {query}")
            return []
        except Exception as e:
            logger.error(f"Error fetching from Semantic Scholar: {e}", exc_info=True)
            return []

    if not data:
        return []

    papers = []
    for item in data.get("data", []):
        external_ids = item.get("externalIds") or {}
        doi = external_ids.get("DOI") or ""
        arxiv_id = external_ids.get("ArXiv") or ""

        if arxiv_id:
            formatted_arxiv = arxiv_id.replace(".", "-").replace("/", "-")
            id_val = f"arx-{formatted_arxiv}"
        else:
            id_val = f"s2-{item.get('paperId')}"

        title = clean_text(item.get("title"))
        abstract = clean_text(item.get("abstract"))
        year = item.get("year") or _CURRENT_YEAR
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
    merged["year"] = p1.get("year") or p2.get("year") or _CURRENT_YEAR
    
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
    """Deduplicate papers using DOI, exact ID, or normalized title matching."""
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


async def search_papers(query: str, page: int = 1, limit: int = 30) -> list[dict]:
    """Perform concurrent fetch from arXiv and Semantic Scholar with pagination and query expansion."""
    expansions = expand_query(query)
    primary_query = expansions[0] if expansions else query
    offset = max(0, (page - 1) * limit)

    arxiv_task = fetch_arxiv(primary_query, limit=limit, offset=offset)
    s2_task = fetch_semantic_scholar(primary_query, limit=limit, offset=offset)
    
    results = await asyncio.gather(arxiv_task, s2_task, return_exceptions=True)
    
    arxiv_papers = results[0] if not isinstance(results[0], Exception) else []
    s2_papers = results[1] if not isinstance(results[1], Exception) else []
    
    if isinstance(results[0], Exception):
        logger.error(f"arXiv query exception: {results[0]}")
    if isinstance(results[1], Exception):
        logger.error(f"Semantic Scholar query exception: {results[1]}")
        
    all_papers = arxiv_papers + s2_papers
    deduped = deduplicate_papers(all_papers)

    # If first page returned sparse results, fallback to academic expansion
    if page == 1 and len(deduped) < 5 and len(expansions) > 1:
        fallback_tasks = []
        for alt_query in expansions[1:]:
            fallback_tasks.append(fetch_arxiv(alt_query, limit=limit, offset=0))
            fallback_tasks.append(fetch_semantic_scholar(alt_query, limit=limit, offset=0))
        
        fallback_results = await asyncio.gather(*fallback_tasks, return_exceptions=True)
        for fb in fallback_results:
            if isinstance(fb, list):
                all_papers.extend(fb)
        deduped = deduplicate_papers(all_papers)

    return deduped
