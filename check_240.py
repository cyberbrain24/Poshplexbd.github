
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'poshplex.settings')
django.setup()
from apps.catalog.models import Product, ProductImage
try:
    p = Product.objects.get(id=240)
    print(f'Product {p.id}: {p.name}')
    for img in p.images.all():
        print(f'  ID: {img.id}, name: {img.image.name}, url: {img.image.url}')
except Exception as e:
    print(e)
