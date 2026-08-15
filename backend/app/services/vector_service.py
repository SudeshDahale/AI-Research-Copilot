"""Embedding generation + pgvector similarity search.

Two things live here:
  1. Calling Voyage AI to turn text into a vector.
  2. Querying Postgres/pgvector for the nearest vectors to a given paper.

Every public function degrades gracefully when VOYAGE_API_KEY isn't set —
callers get None / an empty list back instead of a crash, so the rest of the
app (lexical search, saving papers) keeps working even with no embedding
provider configured.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import voyageai

from app.config import settings
from app.core.logging import logger
from app.models.paper import Paper

_client: voyageai.AsyncClient | None = None


def _get_client() -> voyageai.AsyncClient:
    global _client
    if _client is None:
        _client = voyageai.AsyncClient(api_key=settings.voyage_api_key)
    return _client


async def embed_text(text: str, input_type: str = "document") -> list[float] | None:
    """Embed a single string. input_type is "document" for paper abstracts,
    "query" for search queries — Voyage tunes the vector differently for each,
    which measurably improves retrieval quality."""
    if not settings.voyage_api_key:
        logger.warning("VOYAGE_API_KEY not set — skipping embedding call.")
        return None
    if not text or not text.strip():
        return None

    try:
        client = _get_client()
        result = await client.embed(
            texts=[text],
            model=settings.embedding_model,
            input_type=input_type,
            output_dimension=settings.embedding_dim,
        )
        return result.embeddings[0]
    except Exception as exc:  # pragma: no cover
        logger.error(f"Embedding call failed: {exc}", exc_info=True)
        return None


async def embed_paper(db: AsyncSession, paper: Paper) -> Paper:
    """Embed a paper's abstract (falls back to title if abstract is empty)
    and persist the vector."""
    text = (paper.abstract or "").strip() or (paper.title or "").strip()
    vector = await embed_text(text, input_type="document")
    if vector is not None:
        paper.embedding = vector
        db.add(paper)
        await db.commit()
        await db.refresh(paper)
    return paper


async def ensure_embedding(db: AsyncSession, paper: Paper) -> Paper:
    """Embed the paper only if it doesn't already have a vector — avoids
    re-paying for an embedding call every time a paper is touched."""
    if paper.embedding is not None:
        return paper
    return await embed_paper(db, paper)


async def embed_paper_by_id(paper_id: str) -> None:
    """Standalone entry point for FastAPI BackgroundTasks. Opens its own DB
    session, since the request's session is gone by the time a background
    task actually runs."""
    from app.db.session import AsyncSessionLocal  # local import avoids a cycle at module load

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Paper).where(Paper.id == paper_id))
        paper = result.scalar_one_or_none()
        if paper is None:
            logger.warning(f"embed_paper_by_id: paper {paper_id!r} not found")
            return
        await ensure_embedding(db, paper)


async def find_similar_papers(
    db: AsyncSession, paper: Paper, limit: int = 5
) -> list[tuple[Paper, float]]:
    """Return up to *limit* (paper, similarity) pairs, most similar first.
    similarity is in [0, 1] — 1.0 means identical direction in embedding space.
    Only considers papers that already have an embedding."""
    paper = await ensure_embedding(db, paper)
    if paper.embedding is None:
        return []

    distance = Paper.embedding.cosine_distance(paper.embedding)
    stmt = (
        select(Paper, distance.label("distance"))
        .where(Paper.id != paper.id, Paper.embedding.is_not(None))
        .order_by(distance)
        .limit(limit)
    )
    result = await db.execute(stmt)
    # pgvector's cosine_distance = 1 - cosine_similarity
    return [(row[0], round(1.0 - row[1], 4)) for row in result.all()]


async def get_embeddings_for_ids(
    db: AsyncSession, paper_ids: list[str]
) -> dict[str, list[float]]:
    """Batch-fetch stored embeddings for a set of paper IDs — used by the
    search route to blend semantic similarity into *already-saved* papers
    that show up again in fresh search results."""
    if not paper_ids:
        return {}
    stmt = select(Paper.id, Paper.embedding).where(
        Paper.id.in_(paper_ids), Paper.embedding.is_not(None)
    )
    result = await db.execute(stmt)
    return {row.id: row.embedding for row in result.all()}