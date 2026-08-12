from django.db import migrations, models

def set_unlogged(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute("ALTER TABLE orders_draftcart SET UNLOGGED;")

def set_logged(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute("ALTER TABLE orders_draftcart SET LOGGED;")

class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0009_delete_draftcart'),
    ]

    operations = [
        migrations.CreateModel(
            name='DraftCart',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(db_index=True, max_length=64, unique=True)),
                ('cart_data', models.JSONField(default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.RunPython(set_unlogged, reverse_code=set_logged),
    ]
