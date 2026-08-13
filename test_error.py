import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('185.227.134.236', username='root', password='PoshPlex')

stdin, stdout, stderr = ssh.exec_command('''
sed -i 's/DEBUG=False/DEBUG=True/' /root/poshplex_store/.env
docker restart poshplex_backend
sleep 5
curl -s http://127.0.0.1:8000/api/v1/catalog/products
''')

print(stdout.read().decode('utf-8', errors='ignore'))
ssh.close()
