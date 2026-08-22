
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'poshplex.settings')
django.setup()
from django.core.files.storage import default_storage

try:
    path = 'music/tracks/652de28c9cfd4ed99708ec108b049e07.mp3'
    exists = default_storage.exists(path)
    print(f'Exists {path}: {exists}')
    
    # Also list everything in music/tracks/ just in case
    d, f = default_storage.listdir('music/tracks/')
    print('Files in music/tracks/:', f)
except Exception as e:
    print('Error:', e)
