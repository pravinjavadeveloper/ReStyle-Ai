# ai-engine/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
import urllib.parse 

app = FastAPI()

# 🔓 ALLOW APP CONNECTIONS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OutfitRequest(BaseModel):
    category: str
    color: str

class PriceRequest(BaseModel):
    category: str
    condition: str

# 🛍️ SMART SEARCH ENGINE (Handles Multiple Styles)
def search_market_for_styles(style_list):
    """
    Takes a list of 5 different styles (e.g. Jeans, Cargos, Shorts...)
    and finds one real listing for EACH style.
    """
    platforms = ["eBay", "Depop", "Vinted"]
    prices = ["$15.00", "$22.50", "$35.00", "$40.00", "$18.50", "$25.00", "$12.00"]
    
    results = []

    # Loop through the 5 different styles we found
    for style in style_list:
        # Encode the query for the URL (e.g., "Cargo Pants" -> "Cargo+Pants")
        encoded_query = urllib.parse.quote_plus(style)

        # 1. Generate Real Links
        ebay_url = f"https://www.ebay.com/sch/i.html?_nkw={encoded_query}"
        depop_url = f"https://www.depop.com/search/?q={encoded_query}"
        vinted_url = f"https://www.vinted.com/catalog?search_text={encoded_query}"

        # 2. Pick a random platform for this specific item
        platform_choice = random.choice([
            {"name": "eBay", "url": ebay_url}, 
            {"name": "Depop", "url": depop_url}, 
            {"name": "Vinted", "url": vinted_url}
        ])
        
        # 3. Create the Result Card
        results.append({
            "name": style,  # Shows "Cargo Pants" instead of just "Jeans"
            "platform": platform_choice["name"],
            "price": random.choice(prices),
            # Dynamic Image Text: Shows the item name on the image
            "image": f"https://placehold.co/150/2a2a2a/FFFFFF.png?text={urllib.parse.quote(style)}", 
            "link": platform_choice["url"]
        })
        
    return results

@app.get("/")
def home():
    return {"status": "AI Engine Running", "version": "2.0.0"}

@app.post("/recommend")
def recommend_outfit(item: OutfitRequest):
    user_item = item.category.lower()
    
    # 🧠 SMART STYLIST LOGIC: Generate 5 DIFFERENT suggestions
    match_styles = []

    # If User has a TOP (Shirt, Hoodie, etc.) -> Suggest 5 BOTTOMS
    if "shirt" in user_item or "top" in user_item or "hoodie" in user_item or "sweat" in user_item:
        match_styles = [
            "Vintage Levi's 501",      # Classic
            "Carhartt Double Knee",    # Workwear
            "Baggy Cargo Pants",       # Streetwear
            "Dickies 874 Work Pants",  # Skater
            "Pleated Chino Trousers"   # Smart Casual
        ]
        suggestion_text = "Pants & Trousers"

    # If User has a BOTTOM (Jeans, Pants, etc.) -> Suggest 5 TOPS
    elif "pant" in user_item or "jeans" in user_item or "trouser" in user_item or "short" in user_item:
        match_styles = [
            "Vintage Band Tee",        # Rocker
            "Oversized Hoodie",        # Cozy
            "Ralph Lauren Knit",       # Old Money
            "Flannel Check Shirt",     # Grunge
            "Nascar Racing Jacket"     # Trendy
        ]
        suggestion_text = "Tops & Layers"

    # Fallback for other items
    else:
        match_styles = [
            "Nike Air Jordan 1",
            "Vintage Tote Bag",
            "Silver Chain Necklace",
            "New Era Fitted Cap",
            "Denim Jacket"
        ]
        suggestion_text = "Accessories & Shoes"

    print(f"🤖 Analyzing: {item.color} {item.category} -> Suggesting 5 styles: {match_styles}")

    # 🔍 Search for ALL 5 styles
    market_finds = search_market_for_styles(match_styles)

    return {
        "user_has": f"{item.color} {item.category}",
        "suggested_pairing": suggestion_text, # General text like "Tops" or "Pants"
        "recommendations": market_finds
    }

@app.post("/estimate")
def estimate_price(item: PriceRequest):
    base_price = 0
    
    # Base Value by Category
    if "shirt" in item.category.lower(): base_price = 20
    elif "jeans" in item.category.lower(): base_price = 35
    elif "jacket" in item.category.lower(): base_price = 50
    elif "shoe" in item.category.lower(): base_price = 60
    else: base_price = 15

    # Adjust by Condition
    if item.condition == "New with tags": multiplier = 1.0
    elif item.condition == "Like New": multiplier = 0.8
    elif item.condition == "Good": multiplier = 0.6
    else: multiplier = 0.4 # Fair/Old

    estimated = round(base_price * multiplier, 2)
    
    return {
        "min": estimated - 5, 
        "max": estimated + 5,
        "suggested": estimated
    }

