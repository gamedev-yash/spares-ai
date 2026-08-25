from app.ai.provider_base import LLMProvider, ToolExecutor, ToolSpec


class DemoProvider(LLMProvider):
    """No real model call -- deterministic, templated text. Used when AI_MODE=demo
    (the default, since no API key is required). The chat orchestrator's own rule-based
    routing handles tool selection in this mode, so `run_tool_loop` is not exercised for
    chat; it's implemented for interface completeness and falls back to a single canned
    response if ever invoked directly.
    """

    def complete(self, system_prompt: str, user_message: str) -> str:
        return (
            "[Demo mode -- no LLM configured] Based on the deterministic rules, "
            "here is a plain-language summary of the finding above."
        )

    def run_tool_loop(
        self,
        system_prompt: str,
        user_message: str,
        tools: list[ToolSpec],
        executor: ToolExecutor,
        max_turns: int = 4,
    ) -> str:
        return (
            "[Demo mode] I can look up materials, requisitions, purchase orders, cycle-time, "
            "and approval status, or help you create a new requisition -- ask me directly."
        )
