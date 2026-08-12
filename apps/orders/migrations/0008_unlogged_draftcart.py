from django.db import migrations

def set_unlogged(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute("ALTER TABLE orders_draftcart SET UNLOGGED;")

def set_logged(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute("ALTER TABLE orders_draftcart SET LOGGED;")

class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0007_remove_draftcart_thread_id'),
    ]

    operations = [
        migrations.RunPython(set_unlogged, reverse_code=set_logged),
    ]
