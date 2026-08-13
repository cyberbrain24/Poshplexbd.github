import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print("Connecting to VPS to fix the deployment...")
    ssh.connect('185.227.134.236', username='root', password='PoshPlex')
    
    print("Rebuilding Next.js Storefront container...")
    # Using nohup to ensure it doesn't die if SSH disconnects, but we will just wait for it here
    stdin, stdout, stderr = ssh.exec_command('cd /root/poshplex_store && docker compose up -d --build store')
    
    # Safely print without charmap crashes
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    
    print("STDOUT:\n", out)
    print("STDERR:\n", err)
    
    exit_status = stdout.channel.recv_exit_status()
    if exit_status == 0:
        print("Successfully rebuilt and deployed to production!")
    else:
        print(f"Build failed with exit code {exit_status}")

except Exception as e:
    print(f"Error during deployment: {e}")
finally:
    ssh.close()
