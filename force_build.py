import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print("Connecting to VPS to force clean build...")
    ssh.connect('185.227.134.236', username='root', password='PoshPlex')
    
    # Run completely detached
    ssh.exec_command('cd /root/poshplex_store && nohup docker compose build --no-cache store && docker compose up -d store > build_nocache.log 2>&1 &')
    print("Forced clean build started in background.")

except Exception as e:
    print(f"Error: {e}")
finally:
    ssh.close()
