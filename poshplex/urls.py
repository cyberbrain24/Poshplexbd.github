from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from poshplex.api import api

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', api.urls),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
