
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'poshplex.settings')
django.setup()
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

try:
    print('Attempting to save test file to S3...')
    path = default_storage.save('Upper_Wear/Printed_Drop/products/test_agent_upload.txt', ContentFile(b'Hello R2!'))
    print(f'Successfully saved to {path}')
    
    exists = default_storage.exists(path)
    print(f'Exists check: {exists}')
    
    if exists:
        print('Deleting test file...')
        default_storage.delete(path)
        print('Deleted successfully.')
except Exception as e:
    import traceback
    traceback.print_exc()
