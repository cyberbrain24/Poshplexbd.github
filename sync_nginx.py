import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('185.227.134.236', username='root', password='PoshPlex')
stdin, stdout, stderr = ssh.exec_command('''
cp /etc/nginx/sites-available/poshplex /root/poshplex_store/nginx.host.conf
cat /root/poshplex_store/nginx.host.conf
''')
output = stdout.read().decode('utf-8', errors='ignore')
with open('nginx.host.conf', 'w', newline='\n') as f:
    f.write(output)
ssh.close()
