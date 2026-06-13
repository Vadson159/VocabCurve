import os
import re
import datetime
import hashlib
import urllib.request
import urllib.parse
from urllib.error import URLError
import html

def search_bing_images(query: str, max_results: int = 15):
    """Scrapes Bing Image Search for image URLs matching the query."""
    search_escaped = urllib.parse.quote(query)
    url = f"https://www.bing.com/images/async?q={search_escaped}&first=1&count=35&adlt=off&mmasync=1"
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Cookie': 'SRCHD=AF=NOFORM; SRCHHPGUSR=ADLT=OFF;'
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as s:
            content = s.read().decode("utf-8")
    except URLError as e:
        return {"error": str(e.reason), "images": []}
    except Exception as e:
        return {"error": str(e), "images": []}

    content = html.unescape(content)
    
    # If content has no images, it might be a consent page or block.
    # We will still try to find anything that looks like murl.
    raw_urls = re.findall(r'"murl"\s*:\s*"([^"]+)"', content, re.I)
    
    images = []
    seen = set()
    for raw in raw_urls:
        decoded = urllib.parse.unquote(raw)
        if decoded not in seen and decoded.startswith("http"):
            seen.add(decoded)
            images.append(decoded)
            if len(images) >= max_results:
                break

    return {"error": None, "images": images}

def save_image_from_url(src_url: str, word: str, lang: str, base_dir: str):
    """Downloads an image from a URL and saves it locally."""
    # Ensure language dir exists
    image_dir = os.path.join(base_dir, lang)
    if not os.path.exists(image_dir):
        os.makedirs(image_dir, exist_ok=True)
        
    now = datetime.datetime.now()
    timestamp = now.strftime("%Y%m%d_%H%M%S%f")[:-3]
    hash_part = hashlib.md5(word.encode('utf-8')).hexdigest()[:8]
    filename = f"{timestamp}_{hash_part}.jpg"
    destfile = os.path.join(image_dir, filename)
    
    try:
        req = urllib.request.Request(src_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response, open(destfile, "wb") as out_file:
            out_file.write(response.read())
            
        return {
            "status": "success",
            "filename": filename,
            "url": f"/userimages/{lang}/{filename}",
            "absolute_path": os.path.abspath(destfile).replace('\\', '/')
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
