import requests
try:
    response = requests.get('http://127.0.0.1:8000/api/v1/ai/health')
    print("STATUS", response.status_code)
    print("JSON", response.json())
except Exception as e:
    print(e)
