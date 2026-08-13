import paramiko

print("Uploading to VPS...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('185.227.134.236', username='root', password='PoshPlex')
sftp = ssh.open_sftp()
sftp.put(r'd:\Poshplexbd.github\catalog_dump.json', '/root/poshplex_store/catalog_dump.json')
sftp.put(r'd:\Poshplexbd.github\core_dump.json', '/root/poshplex_store/core_dump.json')
sftp.close()

print("Loading data into PostgreSQL...")
stdin, stdout, stderr = ssh.exec_command('''
cd /root/poshplex_store
# Copy the dumps INTO the container since loaddata requires it in a searchable path, or use absolute path inside container. Wait, docker exec with absolute path from volume or using docker cp:
docker cp catalog_dump.json poshplex_backend:/app/catalog_dump.json
docker cp core_dump.json poshplex_backend:/app/core_dump.json

docker exec poshplex_backend python manage.py loaddata /app/catalog_dump.json
docker exec poshplex_backend python manage.py loaddata /app/core_dump.json
''')

exit_status = stdout.channel.recv_exit_status()
print('EXIT:', exit_status)
print('STDOUT:', stdout.read().decode('utf-8', errors='ignore'))
print('STDERR:', stderr.read().decode('utf-8', errors='ignore'))
ssh.close()
print("Migration complete!")
