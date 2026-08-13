import paramiko
import os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('185.227.134.236', username='root', password='PoshPlex')

sftp = ssh.open_sftp()
sftp.put(r'd:\Poshplexbd.github\docker-compose.prod.yml', '/root/poshplex_store/docker-compose.prod.yml')
sftp.put(r'd:\Poshplexbd.github\poshplex_store\Dockerfile', '/root/poshplex_store/poshplex_store/Dockerfile')
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /root/poshplex_store && docker compose -f docker-compose.prod.yml build store && docker compose -f docker-compose.prod.yml up -d store')
exit_status = stdout.channel.recv_exit_status()
print('EXIT:', exit_status)
print('STDOUT:', stdout.read().decode('utf-8', errors='ignore'))
print('STDERR:', stderr.read().decode('utf-8', errors='ignore'))
ssh.close()
