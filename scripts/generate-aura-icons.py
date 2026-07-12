import os
from PIL import Image

def generate_icons():
    workspace_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    source_logo_path = os.path.join(workspace_dir, "resources", "aionui_logo_no_border.png")
    
    print(f"Loading source logo from: {source_logo_path}")
    if not os.path.exists(source_logo_path):
        raise FileNotFoundError(f"Source logo not found at {source_logo_path}")
        
    img = Image.open(source_logo_path)
    
    # Ensure image has alpha channel/transparency if it's RGBA, or convert to RGBA
    if img.mode != 'RGBA':
        print("Converting source image to RGBA...")
        img = img.convert('RGBA')
        
    # List of PNG destinations and their target dimensions
    png_targets = [
        ("resources/app.png", (2000, 2000)),
        ("resources/icon.png", (2000, 2000)),
        ("resources/app_dev.png", (2000, 2000)),
        ("packages/desktop/src/renderer/assets/logos/brand/app.png", (1024, 1024)),
        ("public/pwa/icon-180.png", (180, 180)),
        ("public/pwa/icon-192.png", (192, 192)),
        ("public/pwa/icon-512.png", (512, 512))
    ]
    
    # Determine the correct resampling filter
    try:
        resample_filter = Image.Resampling.LANCZOS
    except AttributeError:
        resample_filter = Image.LANCZOS
        
    # Generate and save PNG targets
    for rel_path, size in png_targets:
        target_path = os.path.join(workspace_dir, rel_path)
        # Ensure parent directories exist
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        print(f"Generating {rel_path} with size {size}...")
        resized_img = img.resize(size, resample=resample_filter)
        resized_img.save(target_path, format="PNG")
        
    # Generate the multi-resolution ICO file
    ico_path = os.path.join(workspace_dir, "resources", "app.ico")
    ico_sizes = [(16, 16), (20, 20), (24, 24), (32, 32), (40, 40), (48, 48), (64, 64), (128, 128), (256, 256)]
    print(f"Generating multi-resolution ICO file at: resources/app.ico...")
    img.save(ico_path, format="ICO", sizes=ico_sizes)
    print("Icon generation completed successfully!")

if __name__ == "__main__":
    generate_icons()
