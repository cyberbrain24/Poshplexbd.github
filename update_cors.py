import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('185.227.134.236', username='root', password='PoshPlex')
stdin, stdout, stderr = ssh.exec_command("sed -i 's|CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=https://admin.poshplexbd.com,https://store.poshplexbd.com,http://localhost:3000|g' /root/poshplex_store/.env")
print('SED STDOUT:', stdout.read().decode('utf-8', errors='ignore'))
print('SED STDERR:', stderr.read().decode('utf-8', errors='ignore'))

stdin, stdout, stderr = ssh.exec_command("cd /root/poshplex_store && docker compose -f docker-compose.prod.yml restart backend worker")
print('RESTART STDOUT:', stdout.read().decode('utf-8', errors='ignore'))
print('RESTART STDERR:', stderr.read().decode('utf-8', errors='ignore'))
ssh.close()
