
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'poshplex.settings')
django.setup()
from django.core.files.storage import default_storage

try:
    dirs, files = default_storage.listdir('Upper_Wear/Printed_Drop/products/')
    print('Files in Upper_Wear/Printed_Drop/products/:')
    for f in files:
        print(f' - {f}')
except Exception as e:
    print('Error listing dir:', e)
