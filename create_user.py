import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('185.227.134.236', username='root', password='PoshPlex')
stdin, stdout, stderr = ssh.exec_command('docker exec poshplex_backend python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.create_superuser(\'admin_imran\', \'admin@poshplexbd.com\', \'admin_password\') if not User.objects.filter(username=\'admin_imran\').exists() else None"')
print('STDOUT:', stdout.read().decode('utf-8', errors='ignore'))
print('STDERR:', stderr.read().decode('utf-8', errors='ignore'))
ssh.close()
