from pydantic import BaseModel, Field

class SummarySchema(BaseModel):
    objective: str = ""
    methodology: str = ""
    dataset: str = ""
    results: str = ""
    limitations: str = ""

class PaperSchema(BaseModel):
    id: str
    title: str
    authors: list[str] = Field(default_factory=list)
    year: int
    journal: str = ""
    citations: int = 0
    relevance: float = 0.0
    abstract: str = ""
    tags: list[str] = Field(default_factory=list)
    doi: str = ""
    addedAt: str = "Just now"
    status: str = "unread"
    summary: SummarySchema = Field(default_factory=SummarySchema)
    gaps: list[str] = Field(default_factory=list)
    future: list[str] = Field(default_factory=list)
    pdf_url: str | None = None

class SearchRequest(BaseModel):
    query: str
