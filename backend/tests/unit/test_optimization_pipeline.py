import pytest
from unittest.mock import AsyncMock, patch

from app.agents.distillation import distill_paper, distill_papers_context
from app.agents.fast_pipeline import stream_fast_pipeline


def test_distill_paper():
    abstract = "This paper presents a new optimization method for LLM chat pipelines. It drastically lowers latency. The results demonstrate a 70% reduction in response time."
    result = distill_paper("p1", "Fast Chat", abstract, 2026)
    assert "Fast Chat" in result
    assert "2026" in result
    assert "This paper presents a new optimization method" in result
    assert "The results demonstrate a 70% reduction" in result


def test_distill_papers_context_empty():
    res = distill_papers_context([])
    assert res == "No relevant papers available."


def test_distill_papers_context():
    papers = [
        {"id": "1", "title": "Paper One", "abstract": "We explore fast retrieval. It achieves high precision.", "year": 2024},
        {"id": "2", "title": "Paper Two", "abstract": "We introduce deep reasoning. It finds novel gaps.", "year": 2025},
    ]
    res = distill_papers_context(papers, max_papers=2)
    assert "Paper One" in res
    assert "Paper Two" in res


@pytest.mark.asyncio
async def test_stream_fast_pipeline():
    papers = [
        {"id": "1", "title": "Paper One", "abstract": "Abstract content 1.", "year": 2024}
    ]
    
    async def mock_stream_completion(*args, **kwargs):
        yield "Instant "
        yield "answer."

    with patch("app.agents.fast_pipeline.stream_completion", side_effect=mock_stream_completion):
        tokens = []
        async for token in stream_fast_pipeline("What is new?", papers):
            tokens.append(token)
        assert tokens == ["Instant ", "answer."]


@pytest.mark.asyncio
async def test_stream_fast_pipeline_with_history():
    papers = [
        {"id": "1", "title": "Paper One", "abstract": "Abstract content 1.", "year": 2024}
    ]
    history = [
        {"role": "user", "content": "What is attention?"},
        {"role": "assistant", "content": "Attention is a mechanism in deep learning."},
    ]
    
    captured_messages = []

    async def mock_stream_completion(messages, *args, **kwargs):
        captured_messages.extend(messages)
        yield "Follow-up "
        yield "response."

    with patch("app.agents.fast_pipeline.stream_completion", side_effect=mock_stream_completion):
        tokens = []
        async for token in stream_fast_pipeline(
            "Compare it with convolution",
            papers,
            history=history,
        ):
            tokens.append(token)
        assert tokens == ["Follow-up ", "response."]
        user_prompt = captured_messages[1]["content"]
        assert "Recent Conversation Context:" in user_prompt
        assert "What is attention?" in user_prompt
        assert "Attention is a mechanism" in user_prompt

