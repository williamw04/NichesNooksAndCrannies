"""Category-specific search queries for comprehensive coverage."""

CATEGORY_QUERIES = {
    "cafe": {
        "reddit_searches": [
            "hidden gem coffee shop",
            "best coffee neighborhood",
            "underrated cafe",
            "local coffee spot",
            "quiet coffee shop",
            "coffee shop with wifi",
            "independent coffee roaster",
        ],
        "subreddits": ["nyc", "AskNYC", "Coffee", "NYCeats"],
        "google_maps_types": ["cafe", "coffee_shop"],
        "yelp_categories": ["coffee", "cafes", "coffee_roasteries"],
        "eater_maps": ["best-coffee-shops-nyc"],
        "timeout_articles": ["best-coffee-shops-nyc"],
    },
    "restaurant": {
        "reddit_searches": [
            "hidden gem restaurant",
            "underrated restaurant",
            "neighborhood favorite restaurant",
            "best kept secret restaurant",
            "local favorite dinner",
            "authentic ethnic food",
            "hole in the wall",
        ],
        "subreddits": ["nyc", "AskNYC", "FoodNYC", "NYCeats", "nycfood"],
        "google_maps_types": ["restaurant"],
        "yelp_categories": ["restaurants"],
        "eater_maps": [
            "hidden-gem-restaurants-nyc",
            "underrated-restaurants-nyc",
            "essential-restaurants-nyc",
        ],
        "timeout_articles": ["secret-restaurants-nyc"],
    },
    "nature": {
        "reddit_searches": [
            "hidden park",
            "secret garden",
            "nature spot nyc",
            "quiet park",
            "hidden nature",
            "best park view",
            "rooftop garden",
        ],
        "subreddits": ["nyc", "AskNYC", "hiking"],
        "google_maps_types": ["park"],
        "yelp_categories": ["parks", "gardens"],
        "nyc_parks_types": ["community_garden", "nature_preserve", "pocket_park"],
        "timeout_articles": ["secret-new-york", "best-parks-nyc"],
    },
    "historical": {
        "reddit_searches": [
            "historical site",
            "hidden history",
            "historical landmark",
            "historic building",
            "forgotten nyc",
        ],
        "subreddits": ["nyc", "AskNYC", "nycHistory"],
        "google_maps_types": ["museum", "tourist_attraction"],
        "yelp_categories": ["museums", "landmarks"],
        "atlas_obscura": True,
        "timeout_articles": ["secret-new-york"],
    },
    "museum": {
        "reddit_searches": [
            "hidden museum",
            "underrated museum",
            "small museum",
            "niche museum",
            "free museum",
        ],
        "subreddits": ["nyc", "AskNYC", "Museums"],
        "google_maps_types": ["museum", "art_gallery"],
        "yelp_categories": ["museums", "galleries"],
        "timeout_articles": ["best-museums-nyc"],
    },
    "shopping": {
        "reddit_searches": [
            "hidden gem shop",
            "vintage shop",
            "independent bookstore",
            "record store",
            "antique shop",
            "thrift store",
            "local boutique",
        ],
        "subreddits": ["nyc", "AskNYC", "ThriftStoreHauls", "vinyl"],
        "google_maps_types": ["store", "shopping_mall"],
        "yelp_categories": ["shopping", "vintage", "bookstores"],
        "timeout_articles": ["best-vintage-shops-nyc"],
    },
    "adventure": {
        "reddit_searches": [
            "unique experience",
            "things to do",
            "adventure nyc",
            "hidden activity",
            "unusual activity",
            "escape room",
            "axe throwing",
        ],
        "subreddits": ["nyc", "AskNYC"],
        "google_maps_types": ["tourist_attraction", "amusement_park"],
        "yelp_categories": ["active_life", "arts", "entertainment"],
        "timeout_articles": ["things-to-do-nyc"],
    },
    "relaxation": {
        "reddit_searches": [
            "spa hidden gem",
            "quiet spot",
            "relaxing place",
            "wellness center",
            "massage hidden",
            "meditation space",
        ],
        "subreddits": ["nyc", "AskNYC"],
        "google_maps_types": ["spa", "health"],
        "yelp_categories": ["spas", "wellness", "massage"],
        "timeout_articles": ["best-spas-nyc"],
    },
    "nightlife": {
        "reddit_searches": [
            "hidden bar",
            "speakeasy",
            "secret bar",
            "dive bar",
            "neighborhood bar",
            "rooftop bar hidden",
            "cocktail bar underrated",
        ],
        "subreddits": ["nyc", "AskNYC", "nycbars", "cocktails"],
        "google_maps_types": ["bar", "night_club"],
        "yelp_categories": ["bars", "nightlife", "cocktail_bars"],
        "eater_maps": ["best-bars-nyc-hidden"],
        "timeout_articles": ["secret-bars-nyc"],
    },
    "festival": {
        "reddit_searches": [
            "street fair",
            "neighborhood festival",
            "local event",
            "block party",
            "cultural festival",
        ],
        "subreddits": ["nyc", "AskNYC"],
        "google_maps_types": [],
        "yelp_categories": ["festivals"],
        "timeout_articles": ["things-to-do-nyc"],
    },
    "local": {
        "reddit_searches": [
            "hidden gem",
            "neighborhood secret",
            "locals only",
            "off the beaten path",
            "secret spot",
            "underrated",
            "best kept secret",
        ],
        "subreddits": ["nyc", "AskNYC", "NYCeats", "nycbars"],
        "google_maps_types": ["tourist_attraction", "establishment"],
        "yelp_categories": ["local_flavor"],
        "eater_maps": ["essential-restaurants-nyc"],
        "timeout_articles": ["secret-new-york"],
    },
}

DEFAULT_QUERIES = CATEGORY_QUERIES["local"]


def get_queries_for_category(category: str) -> dict:
    """Get search queries for a specific category."""
    return CATEGORY_QUERIES.get(category, DEFAULT_QUERIES)


def get_all_reddit_queries() -> list[tuple[str, str]]:
    """Get all Reddit search queries as (subreddit, query) pairs."""
    queries = []
    for category_data in CATEGORY_QUERIES.values():
        subreddits = category_data.get("subreddits", [])
        searches = category_data.get("reddit_searches", [])
        for subreddit in subreddits:
            for query in searches:
                queries.append((subreddit, query))
    return queries


def get_categories_by_priority() -> list[str]:
    """Get categories prioritized by current data gaps."""
    return [
        "nature",
        "restaurant",
        "shopping",
        "historical",
        "adventure",
        "relaxation",
        "festival",
        "museum",
        "cafe",
        "nightlife",
        "local",
    ]
