
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'poshplex.settings')
django.setup()
from django.core.files.storage import default_storage

try:
    path = 'Upper_Wear/Printed_Drop/products/Dripping_Blood.webp'
    exists = default_storage.exists(path)
    print(f'Exists {path}: {exists}')
    if exists:
        print(f'Size: {default_storage.size(path)}')
except Exception as e:
    print('Error:', e)
