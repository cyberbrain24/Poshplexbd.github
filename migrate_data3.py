import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('185.227.134.236', username='root', password='PoshPlex')

print("Loading data into PostgreSQL (core first)...")
stdin, stdout, stderr = ssh.exec_command('''
cd /root/poshplex_store
docker exec poshplex_backend python manage.py loaddata /app/core_dump.json
docker exec poshplex_backend python manage.py loaddata /app/catalog_dump.json
''')

exit_status = stdout.channel.recv_exit_status()
print('EXIT:', exit_status)
print('STDOUT:', stdout.read().decode('utf-8', errors='ignore'))
print('STDERR:', stderr.read().decode('utf-8', errors='ignore'))
ssh.close()
print("Migration complete!")
