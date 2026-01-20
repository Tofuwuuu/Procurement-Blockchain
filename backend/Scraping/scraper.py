import requests
from bs4 import BeautifulSoup
from typing import List, Dict
import re
from datetime import datetime

def scrape_supplier_from_url(url: str, item_description: str = None) -> List[Dict]:
    """
    Scrape supplier information from a given URL
    Returns a list of supplier items found on the page
    """
    try:
        # Ensure URL has protocol
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extract supplier information
        # This is a generic scraper - you may need to customize based on target websites
        suppliers = []
        
        # Try to find supplier name (common patterns)
        supplier_name = "Unknown Supplier"
        title_tag = soup.find('title')
        if title_tag:
            supplier_name = title_tag.get_text().strip()
        
        # Try to find company name in meta tags or headings
        company_meta = soup.find('meta', property='og:site_name')
        if company_meta:
            supplier_name = company_meta.get('content', supplier_name)
        
        h1_tag = soup.find('h1')
        if h1_tag and not supplier_name or supplier_name == "Unknown Supplier":
            supplier_name = h1_tag.get_text().strip()
        
        # Extract address if available
        address = ""
        address_patterns = [
            soup.find('address'),
            soup.find('div', class_=re.compile(r'address', re.I)),
            soup.find('span', class_=re.compile(r'address', re.I))
        ]
        for addr in address_patterns:
            if addr:
                address = addr.get_text().strip()
                break
        
        # Try to find product/price information
        # Look for common e-commerce patterns
        products = []
        
        # Look for product listings
        product_elements = soup.find_all(['div', 'article', 'li'], class_=re.compile(r'product|item', re.I))
        
        if not product_elements:
            # Fallback: look for any elements with price-like patterns
            price_pattern = re.compile(r'[\d,]+\.?\d*')
            text_elements = soup.find_all(string=price_pattern)
            
            for i, elem in enumerate(text_elements[:10]):  # Limit to first 10
                price_text = re.search(r'[\d,]+\.?\d*', elem)
                if price_text:
                    try:
                        price = float(price_text.group().replace(',', ''))
                        if 10 <= price <= 100000:  # Reasonable price range
                            parent = elem.parent
                            item_desc = item_description or f"Item {i+1}"
                            
                            # Try to find item name nearby
                            if parent:
                                item_name_elem = parent.find(['h2', 'h3', 'h4', 'span', 'a'])
                                if item_name_elem:
                                    item_desc = item_name_elem.get_text().strip()
                            
                            products.append({
                                "item_description": item_desc[:100],  # Limit length
                                "unit_price": price,
                                "category": "General"
                            })
                    except ValueError:
                        continue
        else:
            # Extract from product elements
            for i, product in enumerate(product_elements[:10]):
                item_desc = item_description or f"Item {i+1}"
                price = 0.0
                
                # Find price
                price_elem = product.find(string=re.compile(r'[\d,]+\.?\d*'))
                if price_elem:
                    price_match = re.search(r'[\d,]+\.?\d*', price_elem)
                    if price_match:
                        try:
                            price = float(price_match.group().replace(',', ''))
                        except ValueError:
                            pass
                
                # Find item name
                name_elem = product.find(['h2', 'h3', 'h4', 'a', 'span'], class_=re.compile(r'name|title', re.I))
                if name_elem:
                    item_desc = name_elem.get_text().strip()
                
                if price > 0:
                    products.append({
                        "item_description": item_desc[:100],
                        "unit_price": price,
                        "category": "General"
                    })
        
        # If no products found, create a default entry
        if not products:
            products.append({
                "item_description": item_description or "General Item",
                "unit_price": 0.0,
                "category": "General"
            })
        
        # Create supplier entries
        for i, product in enumerate(products):
            suppliers.append({
                "supplier_name": supplier_name[:100],
                "address": address[:200] if address else "",
                "item_description": product["item_description"],
                "unit_price": product["unit_price"],
                "category": product["category"],
                "url": url,
                "source": "Web Scraping",
                "verified": False,
                "date_scraped": datetime.now().isoformat()
            })
        
        return suppliers
        
    except requests.RequestException as e:
        print(f"Error scraping {url}: {str(e)}")
        return []
    except Exception as e:
        print(f"Unexpected error scraping {url}: {str(e)}")
        return []

def search_public_suppliers(keyword: str, location: str = None):
    """Legacy function for backward compatibility"""
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": f"{keyword} in {location or 'Philippines'}",
        "format": "json",
        "limit": 5
    }
    headers = {"User-Agent": "Academic-Demo-System"}

    try:
        res = requests.get(url, params=params, headers=headers, timeout=10)
        res.raise_for_status()
        
        return [
            {
                "supplier_name": item["display_name"],
                "address": item["display_name"],
                "item_description": keyword,
                "unit_price": 0.0,
                "category": "General",
                "source": "Public Web",
                "verified": False
            }
            for item in res.json()
        ]
    except Exception as e:
        print(f"Error in public supplier search: {str(e)}")
        return []
