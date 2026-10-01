import pytest
import asyncio
from app.services.paper_service import search_papers
from app.services.ranking_service import rank_papers
from app.agents.fast_pipeline import stream_fast_pipeline

@pytest.mark.asyncio
async def test_search_conversational_queries():
    queries = [
        "search papers for reference",
        "search papers for referrence on LLM reasoning",
        "transformer self-attention",
    ]
    for q in queries:
        papers = await search_papers(q, limit=5)
        assert len(papers) > 0, f"Query '{q}' returned 0 papers"
        ranked = rank_papers(q, papers)
        assert len(ranked) > 0, f"Ranking returned 0 papers for '{q}'"
        assert ranked[0]["relevance"] > 0.0

@pytest.mark.asyncio
async def test_fast_pipeline_streaming():
    sample_papers = [{
        "id": "arx-1706-03762",
        "title": "Attention Is All You Need",
        "abstract": "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...",
        "authors": ["Ashish Vaswani", "Noam Shazeer"],
        "year": 2017,
        "journal": "NeurIPS",
        "citations": 90000,
    }]
    chunks = []
    async for chunk in stream_fast_pipeline("What is self-attention?", sample_papers):
        chunks.append(chunk)
    full_text = "".join(chunks)
    assert len(full_text) > 20
