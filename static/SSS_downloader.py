import os
import requests
import argparse

# Define the directory to save the textures
TEXTURE_DIR = './textures'

# Create the directory if it does not exist
if not os.path.exists(TEXTURE_DIR):
    os.makedirs(TEXTURE_DIR)

# Define the URL prefix
URL_PREFIX_1 = 'https://www.solarsystemscope.com/textures/download/'

# JS object as a Python dict with texture file names (without the prefix)
SSS_TEXTURES = {
    'SUN': '2k_sun.jpg',
    'MERCURY': '2k_mercury.jpg',
    'VENUS': '2k_venus_surface.jpg',
    'EARTH': '2k_earth_daymap.jpg',
    'MOON': '2k_moon.jpg',
    'MARS': '2k_mars.jpg',
    'JUPITER': '2k_jupiter.jpg',
    'SATURN': '2k_saturn.jpg',
    'SATURN_RING': '2k_saturn_ring_alpha.jpg',
    'URANUS': '2k_uranus.jpg',
    'NEPTUNE': '2k_neptune.jpg',
    'MILKY_WAY': '2k_stars_milky_way.jpg'
}

# Function to download and save an image
def download_image(name, filename):
    try:
        # Construct the full URL by appending the file name to the prefix
        url = URL_PREFIX_1 + filename

        # Send a GET request to the URL
        response = requests.get(url, stream=True)
        # Raise an error for bad status codes
        response.raise_for_status()

        # Define the local file path
        file_path = os.path.join(TEXTURE_DIR, filename)

        # Write the image to the local file
        with open(file_path, 'wb') as file:
            for chunk in response.iter_content(chunk_size=1024):
                file.write(chunk)

        print(f'{name} texture downloaded successfully.')

        # Return the local file path for the JS object
        return file_path

    except requests.exceptions.RequestException as e:
        print(f'Error downloading {name} texture: {e}')
        return None


# Function to generate the new JS object
def generate_js_object(local_texture_paths):
    print("\nSSS_TEXTURES object with local paths:")
    print("const SSS_TEXTURES = {")
    for name, path in local_texture_paths.items():
        print(f'    {name}: "../{path}",')
    print("};")


# Set up argument parser
def main():
    parser = argparse.ArgumentParser(description='Download textures or \
                                     generate JS object with local paths.')
    parser.add_argument('-p', '--paths-only', action='store_true',
                        help='Generate the JS object with local paths without \
                            downloading the images.')
 
    args = parser.parse_args()

    local_texture_paths = {}

    # If paths_only flag is set, generate JS object without downloading
    if args.paths_only:
        print("Generating the JS object with local paths without downloading the images.")
        # Assume all files are already in the local textures folder
        for name, filename in SSS_TEXTURES.items():
            local_path = os.path.join(TEXTURE_DIR, filename)
            local_texture_paths[name] = local_path.replace('./', '')
    else:
        # Download all textures and modify JS object paths
        for name, filename in SSS_TEXTURES.items():
            local_path = download_image(name, filename)
            if local_path:
                # Use the local file path for the texture in the JS object
                local_texture_paths[name] = local_path.replace('./', '')

    # Generate the new JS object
    generate_js_object(local_texture_paths)


if __name__ == "__main__":
    main()
