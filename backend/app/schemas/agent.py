from pydantic import BaseModel, Field
from typing import Literal


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AgentRunRequest(BaseModel):
    query: str
    workspace_id: str | None = None
    history: list[ChatMessage] = Field(default_factory=list)