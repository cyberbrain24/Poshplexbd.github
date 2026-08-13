import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('185.227.134.236', username='root', password='PoshPlex')
stdin, stdout, stderr = ssh.exec_command('''
echo "NEXT_PUBLIC_API_URL=https://store.poshplexbd.com/api/v1" > /root/poshplex_store/poshplex_store/.env.production
echo "NEXT_PUBLIC_STORE_URL=https://store.poshplexbd.com" >> /root/poshplex_store/poshplex_store/.env.production
cd /root/poshplex_store
docker compose -f docker-compose.prod.yml build store
docker compose -f docker-compose.prod.yml up -d store
''')
exit_status = stdout.channel.recv_exit_status()
print('EXIT:', exit_status)
print('STDOUT:', stdout.read().decode('utf-8', errors='ignore'))
print('STDERR:', stderr.read().decode('utf-8', errors='ignore'))
ssh.close()
