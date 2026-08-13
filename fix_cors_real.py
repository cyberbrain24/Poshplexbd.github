import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('185.227.134.236', username='root', password='PoshPlex')
stdin, stdout, stderr = ssh.exec_command('grep CORS /root/poshplex_store/.env')
env_cors = stdout.read().decode('utf-8', errors='ignore').strip()
print("BEFORE:", env_cors)

# Overwrite it properly
stdin, stdout, stderr = ssh.exec_command("sed -i -E 's/^CORS_ALLOWED_ORIGINS=.*$/CORS_ALLOWED_ORIGINS=https:\\/\\/admin.poshplexbd.com,https:\\/\\/store.poshplexbd.com,http:\\/\\/localhost:3000/g' /root/poshplex_store/.env")
print(stdout.read().decode('utf-8', errors='ignore'))
print(stderr.read().decode('utf-8', errors='ignore'))

# Verify
stdin, stdout, stderr = ssh.exec_command('grep CORS /root/poshplex_store/.env')
print("AFTER:", stdout.read().decode('utf-8', errors='ignore').strip())

# Restart docker containers
stdin, stdout, stderr = ssh.exec_command("cd /root/poshplex_store && docker compose -f docker-compose.prod.yml restart backend worker")
print(stdout.read().decode('utf-8', errors='ignore'))
ssh.close()
