"""Clustering node - Sprint 7.

Groups papers by theme using simple k-means over Sprint 6's embedding
vectors. Falls back to tag-based grouping when fewer than 2 papers have
an embedding (e.g. VOYAGE_API_KEY not set, or nothing saved yet).
"""
from __future__ import annotations

import numpy as np

from app.agents.state import AgentState, Cluster


def _kmeans(vectors: np.ndarray, k: int, iterations: int = 25) -> np.ndarray:
    rng = np.random.default_rng(42)
    centroids = vectors[rng.choice(len(vectors), size=k, replace=False)]

    assignments = np.zeros(len(vectors), dtype=int)
    for _ in range(iterations):
        distances = np.linalg.norm(vectors[:, None, :] - centroids[None, :, :], axis=2)
        new_assignments = distances.argmin(axis=1)
        if np.array_equal(new_assignments, assignments):
            break
        assignments = new_assignments
        for c in range(k):
            members = vectors[assignments == c]
            if len(members):
                centroids[c] = members.mean(axis=0)
    return assignments


def _tag_fallback_clusters(papers: list[dict]) -> list[Cluster]:
    groups: dict[str, list[str]] = {}
    for p in papers:
        tags = p.get("tags") or ["General"]
        key = tags[0]
        groups.setdefault(key, []).append(p["id"])
    return [{"theme": theme, "paper_ids": ids} for theme, ids in groups.items()]


async def clustering_node(state: AgentState) -> dict:
    papers = state.get("ranked_papers") or state.get("papers") or []
    embedded = [p for p in papers if p.get("embedding")]

    if len(embedded) < 2:
        return {"clusters": _tag_fallback_clusters(papers)}

    vectors = np.array([p["embedding"] for p in embedded], dtype=float)
    k = min(4, max(2, len(embedded) // 3))
    assignments = _kmeans(vectors, k)

    clusters: dict[int, list[str]] = {}
    for paper, cluster_idx in zip(embedded, assignments):
        clusters.setdefault(int(cluster_idx), []).append(paper["id"])

    result: list[Cluster] = []
    for idx, paper_ids in clusters.items():
        members = [p for p in embedded if p["id"] in paper_ids]
        common_tags = set(members[0].get("tags") or [])
        for m in members[1:]:
            common_tags &= set(m.get("tags") or [])
        theme = next(iter(common_tags), None) or members[0].get("title", "Cluster")[:40]
        result.append({"theme": theme, "paper_ids": paper_ids})

    return {"clusters": result}