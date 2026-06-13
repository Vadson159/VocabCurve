import json; d=json.load(open('web/public/v1-analyzed.json', encoding='utf-8')); print([x['minOccurrences'] for x in d['frequencyDistribution']])  
