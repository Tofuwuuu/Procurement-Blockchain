import requests
from bs4 import BeautifulSoup
from typing import List, Dict
import re
from datetime import datetime
from urllib.parse import urlparse

REFERENCE_DOMAINS = {
    "wikipedia.org",
    "data.gov.ph",
}

SEARCH_DOMAINS = {
    "google.com",
    "duckduckgo.com",
    "openstreetmap.org",
}

MARKETPLACE_DOMAINS = {
    "globalsources.com",
    "lazada.com.ph",
    "shopee.ph",
    "alibaba.com",
    "procurementone.ph",
}


def _domain_from_url(url: str) -> str:
    netloc = urlparse(url).netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    return netloc


def _domain_matches(domain: str, candidates: set[str]) -> bool:
    return any(domain == candidate or domain.endswith(f".{candidate}") for candidate in candidates)


def classify_source(url: str) -> Dict:
    domain = _domain_from_url(url)
    if _domain_matches(domain, REFERENCE_DOMAINS):
        return {
            "source_type": "Reference",
            "is_supported_supplier_source": False,
            "warning": "Reference source only. It should not be used as a supplier quotation.",
        }
    if _domain_matches(domain, SEARCH_DOMAINS):
        return {
            "source_type": "Search/Map",
            "is_supported_supplier_source": False,
            "warning": "Search or map result page. It does not provide validated supplier quotation details.",
        }
    if _domain_matches(domain, MARKETPLACE_DOMAINS):
        return {
            "source_type": "Marketplace",
            "is_supported_supplier_source": True,
            "warning": "Marketplace data requires manual validation of price, availability, and eligibility.",
        }
    return {
        "source_type": "Supplier Website",
        "is_supported_supplier_source": True,
        "warning": "Generic website extraction. Validate supplier identity and pricing before canvass.",
    }


def enrich_supplier_quality(supplier: Dict) -> Dict:
    url = supplier.get("url") or ""
    source_info = classify_source(url) if url else {
        "source_type": supplier.get("source_type") or "Public Web",
        "is_supported_supplier_source": False,
        "warning": "Public search result. Validate supplier identity before use.",
    }
    supplier.setdefault("source_type", source_info["source_type"])
    supplier.setdefault("extraction_warning", source_info["warning"])

    price = float(supplier.get("unit_price") or 0)
    supplier["price_found"] = price > 0

    supplier_name = (supplier.get("supplier_name") or "").strip().lower()
    looks_like_page_title = any(marker in supplier_name for marker in [
        "wikipedia",
        "google search",
        "duckduckgo",
        "openstreetmap",
    ])

    is_valid = bool(source_info["is_supported_supplier_source"]) and not looks_like_page_title
    supplier["is_valid_supplier"] = is_valid
    supplier["verified"] = bool(supplier.get("verified", False)) and is_valid

    if not is_valid:
        supplier["confidence"] = 20
        supplier["extraction_status"] = "unsupported_source"
    elif not supplier["price_found"]:
        supplier["confidence"] = 45
        supplier["extraction_status"] = "price_missing"
    else:
        supplier["confidence"] = 70
        supplier["extraction_status"] = "needs_validation"

    return supplier

def scrape_supplier_from_url(url: str, item_description: str = None) -> List[Dict]:
    """
    Scrape supplier information from a given URL
    Returns a list of supplier items found on the page
    """
    try:
        # Ensure URL has protocol
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        source_info = classify_source(url)
        
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
            supplier = {
                "supplier_name": supplier_name[:100],
                "address": address[:200] if address else "",
                "item_description": product["item_description"],
                "unit_price": product["unit_price"],
                "category": product["category"],
                "url": url,
                "source": "Web Scraping",
                "source_type": source_info["source_type"],
                "extraction_warning": source_info["warning"],
                "verified": False,
                "date_scraped": datetime.now().isoformat()
            }
            suppliers.append(enrich_supplier_quality(supplier))
        
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
            enrich_supplier_quality({
                "supplier_name": item["display_name"],
                "address": item["display_name"],
                "item_description": keyword,
                "unit_price": 0.0,
                "category": "General",
                "source": "Public Web",
                "source_type": "Search/Map",
                "extraction_warning": "OpenStreetMap can identify places, but it does not provide supplier quotation prices.",
                "verified": False
            })
            for item in res.json()
        ]
    except Exception as e:
        print(f"Error in public supplier search: {str(e)}")
        return []
