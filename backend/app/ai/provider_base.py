from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


@dataclass
class ToolSpec:
    name: str
    description: str
    parameters: dict[str, Any]  # JSON Schema for the tool's arguments


ToolExecutor = Callable[[str, dict[str, Any]], Any]


class LLMProvider(ABC):
    """Abstraction over the LLM backing the chat assistant.

    Implementations never touch the database. `run_tool_loop` lets the model decide which
    (if any) registered tool to call; the orchestrator supplies `executor`, which runs the
    tool through normal, validated backend services (see app/ai/tools.py) -- the model only
    ever sees the JSON result, it never gets a DB handle.
    """

    @abstractmethod
    def complete(self, system_prompt: str, user_message: str) -> str:
        """Simple single-turn completion, no tools -- used for narrative text like the
        PR-quality explanation, where nothing needs to be looked up."""
        raise NotImplementedError

    @abstractmethod
    def run_tool_loop(
        self,
        system_prompt: str,
        user_message: str,
        tools: list[ToolSpec],
        executor: ToolExecutor,
        max_turns: int = 4,
    ) -> str:
        """Run the model, executing any tool calls it requests via `executor`, until it
        returns a final text answer (or `max_turns` is exhausted)."""
        raise NotImplementedError
