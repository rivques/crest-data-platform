import requests
from datetime import datetime

API_KEY = "0k7hHu6kvlCsbJBIeaBZY9eNZSs1KbsSHPGH5LShJnY"
#ENDPOINT = "https://example.com/api/ingest/"  # Change to your domain
ENDPOINT = "http://localhost:8000/api/ingest/"

# Single reading
data = {
    "readings": [
        {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "temp_c": 30.5,
        }
    ]
}

response = requests.post(
    ENDPOINT,
    json=data,
    headers={"Authorization": f"Api-Key {API_KEY}"}
)

if response.ok:
    print(f"Success!")
    print(response.json())
else:
    print(f"Error: {response.json()}")