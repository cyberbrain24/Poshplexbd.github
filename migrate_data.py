import os
import subprocess
import paramiko
import zipfile

# 1. Dump data from local SQLite
print("Dumping data from local SQLite...")
subprocess.run(
    'python manage.py dumpdata --exclude auth.permission --exclude contenttypes > datadump.json',
    shell=True,
    cwd=r'd:\Poshplexbd.github'
)

# 2. Zip the media directory
print("Zipping media directory...")
def zipdir(path, ziph):
    for root, dirs, files in os.walk(path):
        for file in files:
            ziph.write(os.path.join(root, file), 
                       os.path.relpath(os.path.join(root, file), 
                                       os.path.join(path, '..')))

with zipfile.ZipFile(r'd:\Poshplexbd.github\media.zip', 'w', zipfile.ZIP_DEFLATED) as zipf:
    zipdir(r'd:\Poshplexbd.github\media', zipf)

# 3. Upload to VPS
print("Uploading to VPS...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('185.227.134.236', username='root', password='PoshPlex')
sftp = ssh.open_sftp()
sftp.put(r'd:\Poshplexbd.github\datadump.json', '/root/poshplex_store/datadump.json')
sftp.put(r'd:\Poshplexbd.github\media.zip', '/root/poshplex_store/media.zip')
sftp.close()

# 4. Load data into PostgreSQL and extract media
print("Loading data and extracting media on VPS...")
stdin, stdout, stderr = ssh.exec_command('''
cd /root/poshplex_store
# Extract media
apt-get install -y unzip
unzip -o media.zip -d /root/poshplex_store/
# Make sure permissions are right
chown -R root:root /root/poshplex_store/media

# Load data into PostgreSQL
docker exec poshplex_backend python manage.py loaddata datadump.json
''')

exit_status = stdout.channel.recv_exit_status()
print('EXIT:', exit_status)
print('STDOUT:', stdout.read().decode('utf-8', errors='ignore'))
print('STDERR:', stderr.read().decode('utf-8', errors='ignore'))
ssh.close()
print("Migration complete!")
