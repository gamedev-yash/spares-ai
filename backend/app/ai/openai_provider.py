import json

from openai import OpenAI

from app.ai.provider_base import LLMProvider, ToolExecutor, ToolSpec


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model: str):
        self._client = OpenAI(api_key=api_key)
        self._model = model

    def complete(self, system_prompt: str, user_message: str) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_message}],
        )
        return response.choices[0].message.content or ""

    def run_tool_loop(
        self,
        system_prompt: str,
        user_message: str,
        tools: list[ToolSpec],
        executor: ToolExecutor,
        max_turns: int = 4,
    ) -> str:
        openai_tools = [
            {"type": "function", "function": {"name": t.name, "description": t.description, "parameters": t.parameters}}
            for t in tools
        ]
        messages: list[dict] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        for _ in range(max_turns):
            response = self._client.chat.completions.create(model=self._model, messages=messages, tools=openai_tools)
            choice = response.choices[0]
            messages.append(choice.message)

            if choice.finish_reason != "tool_calls" or not choice.message.tool_calls:
                return choice.message.content or ""

            for tool_call in choice.message.tool_calls:
                args = json.loads(tool_call.function.arguments or "{}")
                result = executor(tool_call.function.name, args)
                messages.append({"role": "tool", "tool_call_id": tool_call.id, "content": str(result)})

        return "I wasn't able to finish that in the time I had -- could you rephrase or narrow the request?"
