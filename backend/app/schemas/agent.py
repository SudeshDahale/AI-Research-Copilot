from pydantic import BaseModel


class AgentRunRequest(BaseModel):
    query: str
    workspace_id: str | None = None