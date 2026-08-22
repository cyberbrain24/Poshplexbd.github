
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'poshplex.settings')
django.setup()
from django.core.files.storage import default_storage

try:
    print("Storage type:", type(default_storage.storage))
    objects = list(default_storage.storage.bucket.objects.all()[:5])
    for obj in objects:
        print(obj.key, obj.size)
except Exception as e:
    print('Error:', e)
