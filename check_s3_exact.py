
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'poshplex.settings')
django.setup()
from django.core.files.storage import default_storage

import sys
try:
    path = sys.argv[1]
    exists = default_storage.exists(path)
    print(f'Exists {path}: {exists}')
    if exists:
        print(f'Size: {default_storage.size(path)}')
except Exception as e:
    print('Error:', e)
