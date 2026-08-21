# 🧠 Core Build Principle (This Guides Everything)

> **"Instant response system + background intelligence system"**

- Never block the user for intelligence
- Never sacrifice intelligence for speed
- Never waste tokens on raw data

---

## 🏗️ System Architecture Plan (High Level)

Build the system as **4 independent layers**:

1. **Interface Layer** (Streaming UX)
2. **Fast Intelligence Layer** (Instant Answer)
3. **Deep Intelligence Layer** (Agent System)
4. **Optimization Layer** (Tokens + Caching + Routing)

Each layer must be **loosely coupled**.

---

## ⚙️ Implementation Plan (For Vibe Coding AI)

### 🧩 Phase 1 — Foundation (Do Not Skip)

**Goal:** Separate your system into Fast Path vs Deep Path

**Instructions for AI:**
- Create two pipelines: `fast_pipeline`, `deep_pipeline`
- Ensure:
  - Fast pipeline returns response immediately
  - Deep pipeline runs asynchronously
- Do **NOT** reuse the same flow for both

> 👉 This is where most systems fail.

---

### ⚡ Phase 2 — Fast Pipeline (UX Engine)

**Goal:** Deliver response in 1–3 seconds

**AI Build Instructions:**

**Step 1: Query Intake**
- Accept user query
- Immediately trigger fast pipeline
- Do NOT queue

**Step 2: Retrieval (Optimized)**
- Fetch top 3–5 papers only
- Use cached search if available
- Avoid external API blocking (timeout aggressively)

**Step 3: Context Distillation Layer (Critical)**
- Convert each paper into a 1–2 line insight
- Remove fluff
- Use a cheap model OR rule-based extraction

> 👉 Output must be: highly compressed, structured

**Step 4: Single LLM Synthesis**
- Use ONE strong model call
- Input: query + compressed insights
- Constraints:
  - Max tokens capped
  - Concise output
  - No repeated reasoning

**Step 5: Streaming Response**
- Response must start within ~1 second
- Stream tokens progressively

**Step 6: Trigger Deep Pipeline (Parallel)**
- As soon as fast pipeline starts, trigger deep pipeline in background

---

### 🧠 Phase 3 — Deep Pipeline (Agent Engine)

**Goal:** Deliver high-quality research output without blocking UX

**AI Build Instructions:**

**Step 1: Full Retrieval**
- Fetch broader dataset (5–15 papers)

**Step 2: Parallel Processing**
- Process all papers concurrently
- Never sequential loops

**Step 3: Multi-Step Reasoning**
- Allow: comparison, contradiction detection, synthesis
- BUT: remove redundant LLM calls, merge steps where possible

**Step 4: Structured Knowledge Build**
- Create internal structure: themes, insights, relationships

**Step 5: Final Answer Generation**
- More detailed than fast answer
- Include: deeper reasoning, better coverage

**Step 6: Result Delivery**
- Push result to frontend (NOT polling)
- Mark as: "Refined Answer" or "Improved Insight"

---

### 🔄 Phase 4 — Response Orchestration

**Goal:** Make system feel like ChatGPT

**AI Build Instructions:**
- Show fast answer immediately
- When deep answer arrives:
  - Update UI dynamically
  - Do NOT reload page
  - Do NOT interrupt user flow

**Optional:**
- Show a subtle "Improving answer..." indicator

---

### 💰 Phase 5 — Token Optimization Layer

**Goal:** Reduce tokens without hurting quality

**AI Build Instructions:**

| Rule | Description |
|------|-------------|
| Rule 1: Never send raw abstracts | Always send distilled insights only |
| Rule 2: Enforce Top-K | Fast pipeline: max 5 · Deep pipeline: max 10–15 |
| Rule 3: Use Model Routing | Cheap model → distillation · Strong model → final answer |
| Rule 4: Cap Outputs | Enforce concise answers, prevent long rambling outputs |
| Rule 5: Dynamic Budgeting | Simple query → fewer papers · Complex query → more papers |

---

### ⚡ Phase 6 — Performance Optimization

**Goal:** Make system feel instant

**AI Build Instructions:**

1. **Parallel Everything** — No sequential processing where avoidable
2. **Aggressive Caching** — Cache search results, summaries, embeddings
3. **Timeout Strategy** — External APIs must not block; fallback to cached or partial data
4. **Preprocessing** — Precompute embeddings for papers if possible

---

### 🚫 Phase 7 — What AI Must Not Do

> This is critical to include in your prompt.

❌ Do NOT:
- Use Celery for user-facing response
- Wait for deep pipeline to finish
- Send full documents to LLM
- Run sequential loops for paper processing
- Use multiple LLM calls unnecessarily
- Rely on polling for updates

---

### 🧠 Phase 8 — Quality Safeguards

**Goal:** Avoid degradation due to optimization

**AI Build Instructions:**
- Ensure answers are grounded in provided context
- No hallucinated claims
- Clear linkage to sources
- Prefer fewer high-quality insights over many weak ones

---

## 🏆 Final System Behavior (What You Should Get)

**User experience:**

1. User asks question
2. Response starts instantly (streaming)
3. User gets useful answer in ~2 seconds
4. After a few seconds → answer improves automatically
