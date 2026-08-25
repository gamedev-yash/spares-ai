import anthropic

from app.ai.provider_base import LLMProvider, ToolExecutor, ToolSpec


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str, model: str):
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def complete(self, system_prompt: str, user_message: str) -> str:
        response = self._client.messages.create(
            model=self._model,
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        return "".join(block.text for block in response.content if block.type == "text")

    def run_tool_loop(
        self,
        system_prompt: str,
        user_message: str,
        tools: list[ToolSpec],
        executor: ToolExecutor,
        max_turns: int = 4,
    ) -> str:
        anthropic_tools = [
            {"name": t.name, "description": t.description, "input_schema": t.parameters} for t in tools
        ]
        messages: list[dict] = [{"role": "user", "content": user_message}]

        for _ in range(max_turns):
            response = self._client.messages.create(
                model=self._model,
                max_tokens=1024,
                system=system_prompt,
                tools=anthropic_tools,
                messages=messages,
            )
            messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason != "tool_use":
                return "".join(block.text for block in response.content if block.type == "text")

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = executor(block.name, block.input)
                    tool_results.append(
                        {"type": "tool_result", "tool_use_id": block.id, "content": str(result)}
                    )
            messages.append({"role": "user", "content": tool_results})

        return "I wasn't able to finish that in the time I had -- could you rephrase or narrow the request?"
