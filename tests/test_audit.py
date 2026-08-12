from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.core.models import SiteSetting, AuditLog
from apps.core.middleware import set_current_user

User = get_user_model()

class AuditLoggingTestCase(TestCase):
    def setUp(self):
        # Create test users
        self.admin_user = User.objects.create_superuser(
            username="admin_imran",
            email="imran@poshplex.com",
            password="securepassword123",
            role="admin"
        )
        self.staff_user = User.objects.create_user(
            username="staff_member",
            email="staff@poshplex.com",
            password="staffpassword123",
            role="customer_service"
        )

    def test_audit_log_on_create(self):
        """Test that creating a setting generates a CREATE audit log."""
        set_current_user(self.admin_user)
        
        setting = SiteSetting.objects.create(
            key="site_name",
            value={"name": "Poshplex Streetwear Store"},
            description="Global store name display"
        )
        
        # Verify Audit Log entry is created
        log = AuditLog.objects.filter(model_name="SiteSetting", model_id=str(setting.pk)).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.action, "CREATE")
        self.assertEqual(log.user, self.admin_user)
        self.assertEqual(log.new_values["key"], "site_name")
        self.assertEqual(log.new_values["value"], {"name": "Poshplex Streetwear Store"})
        self.assertEqual(log.old_values, {})

    def test_audit_log_on_update(self):
        """Test that updating a setting logs only the modified values (diffing)."""
        set_current_user(self.admin_user)
        setting = SiteSetting.objects.create(
            key="site_theme",
            value={"primary_color": "#000000", "background": "#ffffff"},
            description="Branding theme details"
        )
        
        # Now update settings under another user
        set_current_user(self.staff_user)
        setting.value = {"primary_color": "#ff0000", "background": "#ffffff"} # changed primary color
        setting.save()
        
        # Verify Audit Log tracks the change diff
        logs = AuditLog.objects.filter(model_name="SiteSetting", model_id=str(setting.pk))
        self.assertEqual(logs.count(), 2) # Create log + Update log
        
        update_log = logs.first() # Meta ordering makes latest timestamp first
        self.assertEqual(update_log.action, "UPDATE")
        self.assertEqual(update_log.user, self.staff_user)
        self.assertEqual(update_log.old_values["value"], {"primary_color": "#000000", "background": "#ffffff"})
        self.assertEqual(update_log.new_values["value"], {"primary_color": "#ff0000", "background": "#ffffff"})

    def test_audit_log_on_delete(self):
        """Test that deleting an audited model logs its final state prior to deletion."""
        set_current_user(self.admin_user)
        setting = SiteSetting.objects.create(
            key="temporary_banner",
            value={"text": "Discount Code: STREET5"},
            description="Banner discount"
        )
        
        pk_str = str(setting.pk)
        
        # Delete object
        setting.delete()
        
        # Verify delete log exists
        delete_log = AuditLog.objects.filter(model_name="SiteSetting", model_id=pk_str, action="DELETE").first()
        self.assertIsNotNone(delete_log)
        self.assertEqual(delete_log.user, self.admin_user)
        self.assertEqual(delete_log.old_values["key"], "temporary_banner")
        self.assertEqual(delete_log.new_values, {})
