import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('185.227.134.236', username='root', password='PoshPlex')
    
    print("Checking Docker containers status...")
    stdin, stdout, stderr = ssh.exec_command('cd /root/poshplex_store && docker compose ps')
    print("PS OUT:\n", stdout.read().decode())
    
    print("Checking Next.js Storefront logs...")
    stdin, stdout, stderr = ssh.exec_command('cd /root/poshplex_store && docker compose logs --tail=50 store')
    # Use errors='replace' to avoid the charmap error locally
    print("LOGS OUT:\n", stdout.read().decode('utf-8', errors='replace'))
    print("LOGS ERR:\n", stderr.read().decode('utf-8', errors='replace'))

except Exception as e:
    print(f"Error during SSH: {e}")
finally:
    ssh.close()
