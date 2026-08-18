
from apps.core.models import SiteSetting
import json

for s in SiteSetting.objects.all():
    val_str = json.dumps(s.value)
    if 'http://store.poshplexbd.com/media/' in val_str or 'https://store.poshplexbd.com/media/' in val_str:
        val_str = val_str.replace('http://store.poshplexbd.com/media/', 'https://media.poshplexbd.com/')
        val_str = val_str.replace('https://store.poshplexbd.com/media/', 'https://media.poshplexbd.com/')
        s.value = json.loads(val_str)
        s.save()
        print(f"Updated setting: {s.key}")
