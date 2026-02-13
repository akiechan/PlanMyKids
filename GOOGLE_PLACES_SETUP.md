# Google Places API Setup Guide

This guide will help you integrate Google Places API to automatically retrieve venue information, reviews, and accurate coordinates.

## 🎯 What You Get

When a user adds a venue address, the app will automatically:
✅ **Geocode** the address (accurate lat/long)
✅ **Import Google Reviews** (5-star ratings and comments)
✅ **Get Hours of Operation** (from Google Business Profile)
✅ **Get Contact Info** (phone, website if available)
✅ **Validate Address** (ensure it's a real place)

## 📝 Step 1: Get Google Places API Key

### 1.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it: "PlanMyKids"
4. Click "Create"

### 1.2 Enable Places API

1. In the sidebar, go to **APIs & Services** → **Library**
2. Search for "Places API"
3. Click "Places API"
4. Click **"Enable"**

### 1.3 Create API Key

1. Go to **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** → **"API Key"**
3. Your API key will be generated (looks like: `AIzaSyXXXXXXXXXXXXXXX`)
4. **Copy it!**

### 1.4 Restrict API Key (Important for Security!)

1. Click on your API key
2. Under "API restrictions":
   - Select "Restrict key"
   - Check only: **Places API**
3. Under "Application restrictions" (optional but recommended):
   - Select "HTTP referrers"
   - Add: `localhost:3000/*` (for development)
   - Add: `your-domain.com/*` (for production)
4. Click "Save"

## 🔧 Step 2: Configure Your App

### 2.1 Add API Key to Environment

Add to your `.env.local`:

```bash
GOOGLE_PLACES_API_KEY=AIzaSyXXXXXXXXXXXXXXX
```

### 2.2 Restart Dev Server

```bash
# Stop current server (Ctrl+C)
npm run dev
```

## 🧪 Step 3: Test It

### Test the API Endpoint

```bash
curl -X POST http://localhost:3000/api/google-places \
  -H "Content-Type: application/json" \
  -d '{"address":"Golden Gate Park, San Francisco"}'
```

Expected response:
```json
{
  "place": {
    "name": "Golden Gate Park",
    "formatted_address": "...",
    "geometry": {
      "location": { "lat": 37.7694, "lng": -122.4862 }
    },
    "reviews": [...]
  }
}
```

## 🚀 Step 4: How It Works

### When Adding a Program:

1. **User enters address**: "2500 Marina Blvd, San Francisco"
2. **App calls Google Places API** automatically
3. **Google returns**:
   - ✅ Verified address
   - ✅ Lat/Long coordinates (37.8053, -122.4371)
   - ✅ Up to 5 most helpful reviews
   - ✅ Hours of operation
   - ✅ Phone number

4. **App stores**:
   - Location in `program_locations` table with accurate lat/long
   - Google reviews in `reviews` table (marked as `source='google'`)
   - Auto-approves Google reviews (they're already vetted)

### Database Storage:

**Reviews Table** now has a `source` field:
- `source='user'` → Submitted via your form (needs approval)
- `source='google'` → Imported from Google (auto-approved)

## 💰 Pricing

**Google Places API is FREE for:**
- First **$200/month** in API calls
- That's approximately:
  - **28,000 Place Details requests** (your use case)
  - **Or 100,000 Find Place requests**

For a community site, you'll likely stay well within the free tier!

## 🔒 Security Best Practices

1. ✅ **API Key Restrictions** - Only allow Places API
2. ✅ **HTTP Referrer Restrictions** - Only your domain
3. ✅ **Environment Variables** - Never commit `.env.local` to git
4. ✅ **Server-Side Only** - API key stays on server (not in browser)

## 📊 Example: What Gets Imported

For "Marina Gymnastics, SF":

```json
{
  "name": "Marina Gymnastics",
  "formatted_address": "2500 Marina Blvd, San Francisco, CA 94123",
  "geometry": {
    "location": { "lat": 37.8053, "lng": -122.4371 }
  },
  "rating": 4.8,
  "user_ratings_total": 127,
  "reviews": [
    {
      "author_name": "Sarah Johnson",
      "rating": 5,
      "text": "My daughter loves this place! The coaches are amazing.",
      "time": 1704067200,
      "relative_time_description": "2 weeks ago"
    }
    // ... up to 5 reviews
  ],
  "opening_hours": {
    "weekday_text": [
      "Monday: 9:00 AM – 8:00 PM",
      "Tuesday: 9:00 AM – 8:00 PM",
      ...
    ]
  },
  "formatted_phone_number": "(415) 555-0123",
  "website": "https://marinagym.com"
}
```

## 🐛 Troubleshooting

### "Google Places API key not configured"
- Make sure `GOOGLE_PLACES_API_KEY` is in your `.env.local`
- Restart the dev server after adding it

### "Place not found"
- Address might be too vague
- Try more specific: "2500 Marina Blvd, San Francisco, CA 94123"

### "Places API error: REQUEST_DENIED"
- API key restrictions might be too strict
- Make sure Places API is enabled in Google Cloud Console

### "Places API error: OVER_QUERY_LIMIT"
- You've exceeded the free tier ($200/month)
- Check your usage in Google Cloud Console

## 🎓 Optional Enhancements

### Display Google Rating Badge
Show "4.8★ on Google (127 reviews)" on program cards

### Auto-Update Reviews
Set up a cron job to refresh Google reviews weekly

### Photo Gallery
Use Places API to fetch photos of the venue

### Nearby Search
Find similar programs in the area

---

**Ready?** Add your API key to `.env.local` and restart the server! 🚀
