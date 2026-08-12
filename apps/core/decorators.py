import json
from django.db import models
from django.core.serializers.json import DjangoJSONEncoder
from apps.core.models import AuditLog
from apps.core.middleware import get_current_user

class AuditedModelMixin(models.Model):
    """
    Abstract model mixin that automatically tracks and logs CREATES, UPDATES, 
    and DELETES to the AuditLog model.
    """
    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        is_create = self.pk is None
        old_values = {}
        
        if not is_create:
            try:
                # Fetch the database state of the object before save
                orig = self.__class__.objects.get(pk=self.pk)
                old_values = self._serialize_model(orig)
            except self.__class__.DoesNotExist:
                # Fallback if object is new but has custom primary key set
                is_create = True
                
        super().save(*args, **kwargs)
        new_values = self._serialize_model(self)
        
        if not is_create:
            # Isolate changes (diffing)
            diff_old = {}
            diff_new = {}
            for key, val in new_values.items():
                old_val = old_values.get(key)
                if old_val != val:
                    diff_old[key] = old_val
                    diff_new[key] = val
                    
            # If no fields were modified, skip audit log creation
            if not diff_old and not diff_new:
                return
                
            action = 'UPDATE'
        else:
            diff_old = {}
            diff_new = new_values
            action = 'CREATE'

        AuditLog.objects.create(
            user=get_current_user(),
            action=action,
            model_name=self.__class__.__name__,
            model_id=str(self.pk),
            old_values=diff_old,
            new_values=diff_new
        )

    def delete(self, *args, **kwargs):
        pk_str = str(self.pk)
        old_values = self._serialize_model(self)
        
        super().delete(*args, **kwargs)
        
        AuditLog.objects.create(
            user=get_current_user(),
            action='DELETE',
            model_name=self.__class__.__name__,
            model_id=pk_str,
            old_values=old_values,
            new_values={}
        )

    def _serialize_model(self, instance) -> dict:
        """Helper to serialize model fields to primitive types."""
        data = {}
        for field in instance._meta.fields:
            # Redact passwords and other high-security credentials from logs
            if field.name in ('password', 'secret_key', 'token'):
                continue
            val = field.value_from_object(instance)
            try:
                serialized = json.loads(json.dumps(val, cls=DjangoJSONEncoder))
                data[field.name] = serialized
            except Exception:
                data[field.name] = str(val)
        return data
