import paramiko
import time
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print("Connecting to VPS to monitor build log...")
    ssh.connect('185.227.134.236', username='root', password='PoshPlex')
    
    print("Waiting for build to finish...")
    for _ in range(20): # Check every 5 seconds, max 100 seconds
        stdin, stdout, stderr = ssh.exec_command('cd /root/poshplex_store && tail -n 20 build.log')
        out = stdout.read().decode('utf-8', errors='replace')
        
        # safely print without crashing windows terminal
        safe_out = out.encode('cp1252', errors='replace').decode('cp1252')
        
        if "Container poshplex_store" in safe_out and ("Started" in safe_out or "Running" in safe_out):
            print("Build completed successfully and container started!")
            sys.exit(0)
            
        time.sleep(5)
        
    print("Timeout waiting for build log.")

except Exception as e:
    print(f"Error during deployment: {e}")
finally:
    ssh.close()
