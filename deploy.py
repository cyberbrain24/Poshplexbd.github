import os
import zipfile
import paramiko

HOST = "185.227.134.236"
USER = "root"
PASS = "PoshPlex"

def zipdir(path, ziph):
    for root, dirs, files in os.walk(path):
        # Exclude large/unnecessary directories
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'venv', '__pycache__', '.next', 'dist', 'postgres_data', 'redis_data']]
        for file in files:
            if not file.endswith('.zip') and not file.endswith('.pyc') and not file == 'deploy.py':
                filepath = os.path.join(root, file)
                arcname = os.path.relpath(filepath, path)
                ziph.write(filepath, arcname)

print("Zipping codebase (excluding node_modules and .git)...")
with zipfile.ZipFile('poshplex.zip', 'w', zipfile.ZIP_DEFLATED) as zipf:
    zipdir('.', zipf)

print("Connecting to VPS via SSH...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)

print("Uploading codebase zip...")
sftp = ssh.open_sftp()
sftp.put('poshplex.zip', '/root/poshplex.zip')
sftp.close()

print("Executing remote deployment commands...")
# Using a single script execution so we don't drop context
script = """
set -e
apt-get update
apt-get install -y unzip dos2unix
rm -rf /root/poshplex_store
unzip -o /root/poshplex.zip -d /root/poshplex_store
cd /root/poshplex_store
cp .env.production.example .env
dos2unix deploy_ubuntu.sh
chmod +x deploy_ubuntu.sh
./deploy_ubuntu.sh
"""

stdin, stdout, stderr = ssh.exec_command(script)
exit_status = stdout.channel.recv_exit_status()

print("--- DEPLOYMENT OUTPUT ---")
print(stdout.read().decode('utf-8', errors='ignore'))
print("--- ERRORS (IF ANY) ---")
print(stderr.read().decode('utf-8', errors='ignore'))
print(f"Exit status: {exit_status}")

ssh.close()
print("Process completed!")
