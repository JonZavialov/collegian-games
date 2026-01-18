# -*- coding: utf-8 -*-
import json
import requests
import re
import time
import logging
import sys
from datetime import datetime, timedelta, timezone
from bs4 import BeautifulSoup

logging.basicConfig(
    level=logging.INFO, 
    format="%(asctime)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

def clean_xml(raw_bytes):
    """Strips control characters that break XML parsers."""
    text = raw_bytes.decode('utf-8', errors='ignore')
    return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

def scrape():
    all_articles = {}
    # Capturing last 14 days to ensure we never miss an update
    cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    limit = 100
    offset = 0
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'}

    while True:
        url = f"https://www.psucollegian.com/search/?f=rss&t=article&l={limit}&o={offset}&s=start_time&sd=desc"
        logging.info(f"Fetching batch: offset {offset}...")
        
        try:
            resp = requests.get(url, headers=headers, timeout=30)
            if resp.status_code != 200:
                logging.error(f"Failed with status {resp.status_code}")
                break

            # Parse with 'xml' features for speed and namespace support
            soup = BeautifulSoup(clean_xml(resp.content), "xml") 
            items = soup.find_all("item")
            
            if not items:
                logging.info("No more articles found in feed.")
                break

            new_in_batch = 0
            for item in items:
                try:
                    # Parse Date
                    pdate_str = item.find("pubDate").text.strip()
                    pdate = datetime.strptime(pdate_str, "%a, %d %b %Y %H:%M:%S %z")
                    
                    if pdate < cutoff:
                        continue
                    
                    # Extract Data
                    link = item.find("link").text.strip()
                    # Extract unique UUID from the filename
                    guid = link.split('_')[-1].replace('.html', '')

                    if guid not in all_articles:
                        # Handle namespaces for Author
                        author_tag = item.find("dc:creator") or item.find("creator")
                        author = author_tag.text.strip() if author_tag else "The Daily Collegian"

                        all_articles[guid] = {
                            "guid": guid,
                            "title": item.find("title").text.strip(),
                            "author": author,
                            "description": item.find("description").text.strip(),
                            "pub_date": pdate.isoformat(),
                            "link": link
                        }
                        new_in_batch += 1
                except Exception:
                    continue

            logging.info(f"  Processed batch. Added {new_in_batch} articles.")
            
            # If we found 0 new articles in a full batch, we've hit the date cutoff
            if new_in_batch == 0 and len(items) > 0:
                logging.info("Reached the 14-day limit. Stopping.")
                break
                
            offset += limit
            time.sleep(2) # Respectful delay to stay in Tier 3

        except Exception as e:
            logging.error(f"Critical error during scrape: {e}")
            break

    # Final Save
    output = {
        "metadata": {
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "total_articles": len(all_articles)
        },
        "articles": list(all_articles.values())
    }
    
    with open("articles.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    
    logging.info(f"DONE. Saved {len(all_articles)} unique articles.")

if __name__ == "__main__":
    scrape()