import traceback
from app.modules.ai.providers import get_provider

try:
    p = get_provider()
    print("Provider initialized:", p)
except Exception as e:
    traceback.print_exc()
