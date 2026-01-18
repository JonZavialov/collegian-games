# -*- coding: utf-8 -*-
import os
import json
import requests
import re
import time
import logging
import psycopg2
from datetime import datetime, timedelta, timezone
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Load local .env for local testing, GH Actions uses Secrets
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=os.getenv("DB_PORT", "5432")
    )

def clean_xml(raw_bytes):
    text = raw_bytes.decode('utf-8', errors='ignore')
    return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

def scrape():
    all_articles = {}
    cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    limit, offset = 100, 0
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'}

    while True:
        url = f"https://www.psucollegian.com/search/?f=rss&t=article&l={limit}&o={offset}&s=start_time&sd=desc"
        logging.info(f"Fetching batch: offset {offset}...")
        
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code != 200: break

        soup = BeautifulSoup(clean_xml(resp.content), "xml") 
        items = soup.find_all("item")
        if not items: break

        new_in_batch = 0
        for item in items:
            try:
                pdate = datetime.strptime(item.find("pubDate").text.strip(), "%a, %d %b %Y %H:%M:%S %z")
                if pdate < cutoff: continue
                
                link = item.find("link").text.strip()
                guid = link.split('_')[-1].replace('.html', '')

                if guid not in all_articles:
                    author_tag = item.find("dc:creator") or item.find("creator")
                    all_articles[guid] = {
                        "guid": guid,
                        "title": item.find("title").text.strip(),
                        "author": author_tag.text.strip() if author_tag else "The Daily Collegian",
                        "description": item.find("description").text.strip(),
                        "pub_date": pdate.isoformat(),
                        "link": link
                    }
                    new_in_batch += 1
            except: continue

        if new_in_batch == 0 and len(items) > 0: break
        offset += limit
        time.sleep(2)

    # --- DATABASE INSERTION ---
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        logging.info(f"Syncing {len(all_articles)} articles to Postgres...")
        
        for art in all_articles.values():
            cur.execute("""
                INSERT INTO articles (guid, title, content, author, pub_date, url, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (guid) DO UPDATE SET
                    title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    updated_at = now();
            """, (art['guid'], art['title'], art['description'], art['author'], art['pub_date'], art['link']))
        
        conn.commit()
        cur.close()
        logging.info("Database sync complete.")
    except Exception as e:
        logging.error(f"Database error: {e}")
    finally:
        if conn: conn.close()

    # Save JSON as backup
    with open("articles.json", "w", encoding="utf-8") as f:
        json.dump(list(all_articles.values()), f, indent=2)

if __name__ == "__main__":
    scrape()