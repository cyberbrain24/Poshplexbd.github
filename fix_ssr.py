import os

def replace_api_url():
    target_str = '${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}'
    replacement = '${process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}'
    
    target_str2 = 'process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"'
    replacement2 = 'process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"'

    dirs_to_check = ['poshplex_store/app', 'poshplex_store/context', 'poshplex_store/lib']
    
    count = 0
    for directory in dirs_to_check:
        for root, _, files in os.walk(directory):
            for file in files:
                if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
                    path = os.path.join(root, file)
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                    if target_str in content or target_str2 in content:
                        new_content = content.replace(target_str, replacement)
                        # Also replace the non-template literal version
                        new_content = new_content.replace(target_str2, replacement2)
                        
                        with open(path, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        count += 1
                        print(f"Updated {path}")
                        
    print(f"Total files updated: {count}")

if __name__ == "__main__":
    replace_api_url()
