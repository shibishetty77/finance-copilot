import asyncio
import os
import sys

# Set up environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.modules.ai.providers import get_provider_for_settings, get_provider
from app.config import settings

async def main():
    print(f"Ollama URL from settings: {settings.OLLAMA_URL}")
    print(f"Ollama Model from settings: {settings.OLLAMA_MODEL}")
    
    provider1 = get_provider_for_settings(mode="cloud")
    print(f"\nProvider from get_provider_for_settings: {provider1.provider_name}")
    print(f"Model: {provider1.model_name}")
    
    provider2 = get_provider()
    print(f"\nProvider from get_provider: {provider2.provider_name}")
    print(f"Model: {provider2.model_name}")
    
    print("\nTesting health check...")
    try:
        healthy = await provider1.health_check()
        print(f"Health check passed: {healthy}")
    except Exception as e:
        print(f"Health check failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
