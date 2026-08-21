import os
import re

search_dir = r'd:\Poshplexbd.github\apps'
# Pattern to match: os.environ.get('SITE_BASE_URL', 'http://localhost:8000') OR os.environ.get("SITE_BASE_URL", "http://localhost:8000")
pattern = re.compile(r"os\.environ\.get\(['\"]SITE_BASE_URL['\"],\s*['\"]http://localhost:8000['\"]\)")
replacement = "os.environ.get('SITE_BASE_URL', 'https://poshplexbd.com' if not __import__('django.conf').conf.settings.DEBUG else 'http://localhost:8000')"

for root, _, files in os.walk(search_dir):
    for file in files:
        if file.endswith('.py'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            if pattern.search(content):
                new_content = pattern.sub(replacement, content)
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f'Updated {filepath}')
