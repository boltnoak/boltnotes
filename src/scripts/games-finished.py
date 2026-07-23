import json
import sys
from collections import Counter

with open(sys.argv[1], 'r', encoding='utf-8') as f:
    campaigns = json.load(f)

years = []
for game in campaigns:
    if game.get('status', '').lower() == 'zerado' and game.get('completeDate'):
        try:
            year = game['completeDate'].split('/')[-1]
            years.append(year)
        except:
            pass

contagem = Counter(years)
resultado = dict(sorted(contagem.items()))

print(json.dumps(resultado))