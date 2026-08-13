import paramiko
import time
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print("Connecting to VPS to monitor build_nocache.log...")
    ssh.connect('185.227.134.236', username='root', password='PoshPlex')
    
    for _ in range(30): # check for up to 150 seconds
        stdin, stdout, stderr = ssh.exec_command('cd /root/poshplex_store && tail -n 30 build_nocache.log')
        out = stdout.read().decode('utf-8', errors='replace')
        
        safe_out = out.encode('cp1252', errors='replace').decode('cp1252')
        print("LOG TAIL:\n" + safe_out)
        
        if "Container poshplex_store-store-1" in safe_out and "Started" in safe_out:
            print("Successfully deployed!")
            sys.exit(0)
            
        time.sleep(5)
        print("Checking again...")

except Exception as e:
    print(f"Error: {e}")
finally:
    ssh.close()
