import paramiko
import os

files_to_sync = [
    'poshplex_store/app/page.tsx',
    'poshplex_store/app/components/Header.tsx',
    'poshplex_store/app/components/FeaturedReviewsCarousel.tsx',
    'poshplex_store/app/components/FloatingPlayer.tsx'
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print("Connecting to VPS...")
    ssh.connect('185.227.134.236', username='root', password='PoshPlex')
    
    sftp = ssh.open_sftp()
    
    print("Uploading optimized files to VPS...")
    for file_path in files_to_sync:
        local_path = os.path.join(os.getcwd(), os.path.normpath(file_path))
        remote_path = f"/root/poshplex_store/{file_path.replace(chr(92), '/')}"
        
        print(f"Uploading {local_path} -> {remote_path}")
        sftp.put(local_path, remote_path)
    
    sftp.close()
    
    print("Rebuilding Next.js Storefront container on VPS...")
    # This will rebuild the Next.js app, pulling in the new <Image> tags and aria-labels
    stdin, stdout, stderr = ssh.exec_command('cd /root/poshplex_store && docker compose up -d --build store')
    
    # Wait for completion and print output
    exit_status = stdout.channel.recv_exit_status()
    print("STDOUT:", stdout.read().decode())
    print("STDERR:", stderr.read().decode())
    
    if exit_status == 0:
        print("Successfully rebuilt and deployed to production!")
    else:
        print(f"Build failed with exit code {exit_status}")

except Exception as e:
    print(f"Error during deployment: {e}")
finally:
    ssh.close()
