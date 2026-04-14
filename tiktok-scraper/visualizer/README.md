# Hidden Gems Location Visualizer

An interactive map visualization app for exploring TikTok location data.

## Quick Start

1. **Get a Google Maps API Key**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable **Maps JavaScript API** and **Geocoding API**
   - Create credentials (API key)

2. **Configure the API Key**
   
   Option A - URL parameter:
   ```
   index.html?key=YOUR_API_KEY_HERE
   ```
   
   Option B - Create `config.js`:
   ```javascript
   const GOOGLE_MAPS_API_KEY = 'YOUR_API_KEY_HERE';
   ```

3. **Open in Browser**
   - Open `index.html` in a browser (or serve via a local server)

## Features

- **Auto-location**: On first load, detects your location and centers the map
- **Search**: Search for any city/location to move the map view
- **Search This Area**: After zooming/panning, click to reload all spots in the current view
- **Location Markers**: Each marker shows:
  - Location name
  - Category
  - Engagement (likes, comments)
  - Source (TikTok)
- **Real-time Count**: Shows number of visible locations in the current map view

## Marker Colors

- Red: Gem Level 1 (Iconic)
- Yellow: Gem Level 2 (Local Favorite)  
- Green: Gem Level 3 (Hidden Gem)

## Data Source

The app loads the latest location data from:
```
../output/locations-*.json
```

Run the scraper first to generate data, then refresh the visualizer.

## Running a Local Server

Since the app loads JSON files, you'll need a local server:

```bash
# Using npm (recommended)
npm run serve

# Then open http://localhost:8000/visualizer/
```

Or use Python:

```bash
# Python 3
python -m http.server 8000

# Then open http://localhost:8000/visualizer/
```