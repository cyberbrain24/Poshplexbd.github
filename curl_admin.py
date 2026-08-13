import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('185.227.134.236', username='root', password='PoshPlex')
stdin, stdout, stderr = ssh.exec_command("curl -I --insecure https://127.0.0.1 -H 'Host: admin.poshplexbd.com'")
print("STDOUT:", stdout.read().decode('utf-8', errors='ignore'))
print("STDERR:", stderr.read().decode('utf-8', errors='ignore'))
ssh.close()
