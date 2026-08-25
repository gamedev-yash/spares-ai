from functools import lru_cache

from app.ai.demo_provider import DemoProvider
from app.ai.provider_base import LLMProvider
from app.config import get_settings


@lru_cache
def get_llm_provider() -> LLMProvider:
    """AI_MODE=demo (default, no key required) or AI_MODE=provider (+ AI_PROVIDER, + the
    matching API key). Never silently falls back from provider to demo on missing config --
    that would let a demo response be mistaken for a real one; it raises instead.
    """
    settings = get_settings()

    if settings.ai_mode == "demo":
        return DemoProvider()

    if settings.ai_provider == "anthropic":
        if not settings.anthropic_api_key:
            raise RuntimeError("AI_MODE=provider with AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY")
        from app.ai.anthropic_provider import AnthropicProvider

        return AnthropicProvider(api_key=settings.anthropic_api_key, model=settings.anthropic_model)

    if settings.ai_provider == "openai":
        if not settings.openai_api_key:
            raise RuntimeError("AI_MODE=provider with AI_PROVIDER=openai requires OPENAI_API_KEY")
        from app.ai.openai_provider import OpenAIProvider

        return OpenAIProvider(api_key=settings.openai_api_key, model=settings.openai_model)

    raise RuntimeError(f"Unknown AI_PROVIDER: {settings.ai_provider}")


def is_demo_mode() -> bool:
    return get_settings().ai_mode == "demo"
