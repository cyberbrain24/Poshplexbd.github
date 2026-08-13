import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print("Connecting to VPS to run detached build...")
    ssh.connect('185.227.134.236', username='root', password='PoshPlex')
    
    print("Starting background build on VPS...")
    # Run detached so SSH disconnecting doesn't kill the build
    stdin, stdout, stderr = ssh.exec_command('cd /root/poshplex_store && nohup docker compose up -d --build store > build.log 2>&1 &')
    
    print("Build started on server in background.")
    
except Exception as e:
    print(f"Error during deployment: {e}")
finally:
    ssh.close()
