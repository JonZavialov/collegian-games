# -*- coding: utf-8 -*-
import os
import re
import json
import requests
import xml.etree.ElementTree as ET
import psycopg2
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# --- Setup ---
BASE_DIR = Path(__file__).resolve().parent
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout), logging.FileHandler(BASE_DIR / "scraper.log")]
)
load_dotenv(BASE_DIR / ".env")

# --- Config ---
# We use 'o' for offset to paginate through results
RSS_TEMPLATE = (
    "https://www.psucollegian.com/search/?"
    "f=rss&t=article&l=100&s=start_time&sd=desc"
    "&d1=7%20days%20ago"
    "&fulltext=collegian3345&o={offset}"
)

GUID_RE = re.compile(r"([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})", re.I)

def clean_text(html: str) -> str:
    soup = BeautifulSoup(html or "", "html.parser")
    text = soup.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text).lower()

def fetch_rss_page(offset):
    url = RSS_TEMPLATE.format(offset=offset)
    
    # Create a session to persist cookies (some servers require this)
    session = requests.Session()
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/xml,application/xml,application/xhtml+xml,text/html;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1', # Do Not Track
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
    }
    
    try:
        logging.info(f"Requesting offset {offset}...")
        resp = session.get(url, headers=headers, timeout=30)
        
        # Log the status and a snippet of content for debugging in GitHub Actions
        logging.info(f"Status: {resp.status_code}")
        
        if resp.status_code == 429:
            logging.error("Rate Limited (429). The server has flagged this IP.")
            return None
            
        if not resp.content or b"<rss" not in resp.content.lower():
            logging.warning("Response does not look like RSS XML.")
            # This logs the first 200 chars so you can see if it's a 'Access Denied' HTML page
            logging.info(f"Content Preview: {resp.text[:200]}")
            return None
            
        return resp.content
    except Exception as e:
        logging.error(f"Fetch error: {e}")
        return None
        
def get_db_connection():
    try:
        return psycopg2.connect(
            host=os.getenv("DB_HOST"),
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            port=os.getenv("DB_PORT", "5432")
        )
    except: return None

def main():
    all_articles_data = []
    offset = 0
    limit = 100
    
    # 1. Paginated Scrape
    while True:
        logging.info(f"Fetching articles with offset {offset}...")
        rss_bytes = fetch_rss_page(offset)
        if not rss_bytes: break
        
        try:
            root = ET.fromstring(rss_bytes)
        except: break
            
        items = root.findall(".//item")
        if not items: break
        
        for item in items:
            guid_raw = item.findtext("guid") or ""
            guid_match = GUID_RE.search(guid_raw)
            if not guid_match: continue
            
            pub_date_raw = item.findtext("pubDate")
            try:
                pub_date = datetime.strptime(pub_date_raw, "%a, %d %b %Y %H:%M:%S %z")
            except: continue

            article = {
                "guid": guid_match.group(1),
                "title": item.findtext("title"),
                "content": clean_text(item.findtext("description")),
                "author": item.findtext("{http://purl.org/dc/elements/1.1/}creator") or "Unknown",
                "pub_date": pub_date.isoformat(),
                "url": item.findtext("link")
            }
            all_articles_data.append(article)

        if len(items) < limit: break
        offset += limit
        if offset > 1000: break # Safety break

    # 2. Save to JSON (For the Game)
    with open(BASE_DIR / "articles.json", "w", encoding="utf-8") as f:
        json.dump(all_articles_data, f, indent=2)
    logging.info(f"Saved {len(all_articles_data)} articles to articles.json")

    # 3. Sync to Postgres (Optional/Internal)
    conn = get_db_connection()
    if conn:
        cur = conn.cursor()
        for a in all_articles_data:
            try:
                cur.execute("""
                    INSERT INTO public.articles (guid, title, content, author, pub_date, url, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, now(), now())
                    ON CONFLICT (guid) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content, updated_at=now();
                """, (a['guid'], a['title'], a['content'], a['author'], a['pub_date'], a['url']))
            except Exception as e: logging.error(f"DB Error: {e}"); conn.rollback()
        conn.commit()
        cur.close(); conn.close()

if __name__ == "__main__":
    main()
