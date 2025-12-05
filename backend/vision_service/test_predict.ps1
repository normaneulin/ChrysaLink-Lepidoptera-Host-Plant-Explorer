$body = @{ imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Female_Butterfly.jpg'; top_k = 5 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/predict -Headers @{ 'Content-Type' = 'application/json' } -Body $body | ConvertTo-Json -Depth 5
