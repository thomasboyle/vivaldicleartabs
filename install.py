import os
import shutil
import glob
import sys

def find_vivaldi_path():
    local_appdata = os.environ.get('LOCALAPPDATA')
    base_path = os.path.join(local_appdata, 'Vivaldi', 'Application')
    
    if not os.path.exists(base_path):
        print(f"Base path not found: {base_path}")
        return None
        
    # Find version folder
    versions = []
    for item in os.listdir(base_path):
        if item[0].isdigit() and os.path.isdir(os.path.join(base_path, item)):
            versions.append(item)
            
    if not versions:
        print("No version folder found.")
        return None
        
    versions.sort(key=lambda s: [int(u) for u in s.split('.')])
    latest_version = versions[-1]
    
    resources_path = os.path.join(base_path, latest_version, 'resources', 'vivaldi')
    if os.path.exists(resources_path):
        return resources_path
    
    print(f"Resources path not found at: {resources_path}")
    return None

def install_mod():
    print("Locating Vivaldi...")
    vivaldi_path = find_vivaldi_path()
    if not vivaldi_path:
        print("Could not find Vivaldi installation.")
        return

    print(f"Found Vivaldi at: {vivaldi_path}")
    
    window_html = os.path.join(vivaldi_path, 'window.html')
    if not os.path.exists(window_html):
        print("window.html not found!")
        return

    # Backup
    backup_path = window_html + ".bak"
    if not os.path.exists(backup_path):
        print("Creating backup of window.html...")
        shutil.copy2(window_html, backup_path)
    else:
        print("Backup already exists.")

    # Copy JS and CSS
    current_dir = os.path.dirname(os.path.abspath(__file__))
    js_file = os.path.join(current_dir, 'custom.js')
    css_file = os.path.join(current_dir, 'custom.css')
    
    dest_js = os.path.join(vivaldi_path, 'custom.js')
    dest_css = os.path.join(vivaldi_path, 'custom.css') # Not strictly needed if folder mod is on, but consistent
    
    print(f"Copying {js_file} to {dest_js}")
    shutil.copy2(js_file, dest_js)
    
    # We mainly need to Patch JS. CSS is loaded by Vivaldi if settings enabled 
    
    print("Patching window.html...")
    with open(window_html, 'r', encoding='utf-8') as f:
        content = f.read()
        
    script_tag = '<script src="custom.js"></script>'
    
    if script_tag in content:
        print("Mod already patched in window.html")
    else:
        if '</body>' in content:
            new_content = content.replace('</body>', f'{script_tag}</body>')
            with open(window_html, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("Successfully patched window.html")
        else:
            print("Could not find </body> tag in window.html")
            
    print("Installation Complete. Please restart Vivaldi.")

if __name__ == "__main__":
    try:
        install_mod()
    except Exception as e:
        print(f"Error: {e}")
    input("Press Enter to exit...")
