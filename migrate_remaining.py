import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('185.227.134.236', username='root', password='PoshPlex')

print("Uploading remaining dump to VPS...")
sftp = ssh.open_sftp()
sftp.put(r'd:\Poshplexbd.github\remaining_dump.json', '/root/poshplex_store/remaining_dump.json')
sftp.close()

print("Loading data into PostgreSQL...")
stdin, stdout, stderr = ssh.exec_command('''
cd /root/poshplex_store
docker cp remaining_dump.json poshplex_backend:/app/remaining_dump.json
docker exec poshplex_backend python manage.py loaddata /app/remaining_dump.json
''')

exit_status = stdout.channel.recv_exit_status()
print('EXIT:', exit_status)
print('STDOUT:', stdout.read().decode('utf-8', errors='ignore'))
print('STDERR:', stderr.read().decode('utf-8', errors='ignore'))
ssh.close()
print("Migration complete!")
