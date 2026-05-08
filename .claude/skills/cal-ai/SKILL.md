Cal AI - Nutrition Tracker

---
name: cal-ai
description: >
  Build the Cal AI nutrition tracker app — a React + Vite + TypeScript + Tailwind CSS
  single-page app that lets users upload meal photos and get instant calorie and macro
  breakdowns via an n8n webhook. Use when the user asks to build a food photo analyzer,
  nutrition tracker, meal logging app, calorie counter, or macro tracker with image upload.
  Also use when the user mentions "Cal AI" or "n8n nutrition webhook" by name.
---

Build the Cal AI nutrition tracker app according to the full specification below.
If the user provides additional instructions via arguments, incorporate them.
Follow every detail — component structure, API contract, UI design, error handling, and mock data.

A web app that analyzes food photos and provides instant nutrition information. Users upload a meal photo, and AI returns calories, macros, and ingredient breakdown.

Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: N8n workflow (external - user provides webhook URL)
- **Styling**: Modern, clean design with gradients and smooth animations

Project Structure

src/
├── components/
│   ├── ImageUpload.tsx      # Drag-drop & click-to-upload component
│   ├── NutritionResult.tsx  # Displays analysis results
│   ├── MacroCard.tsx        # Individual macro display (calories, protein, etc.)
│   └── FoodBreakdown.tsx    # List of detected food items
├── hooks/
│   └── useNutritionAnalysis.ts  # API call hook
├── types/
│   └── nutrition.ts         # TypeScript interfaces
├── App.tsx
├── main.tsx
└── index.css

Core Features

1. Image Upload

- Drag-and-drop zone with visual feedback
- Click to open file picker
- Image preview before analysis
- Accept: jpg, png, webp
- Max size: 10MB

2. Analysis Display

- Total calories (large, prominent)
- Macros: Protein, Carbs, Fat (in grams with visual bars)
- Food breakdown: List of detected ingredients with individual calories

API Integration

Webhook Endpoint

The app calls an N8n webhook. The URL is configurable via environment variable:

VITE_WEBHOOK_URL=https://your-n8n-instance.com/webhook/meal-ai

Request Format

// POST request with image as binary via FormData
// Content-Type: multipart/form-data (set automatically by browser)
const formData = new FormData();
formData.append('image', file, file.name);

fetch(webhookUrl, {
  method: 'POST',
  body: formData,
});
// N8n receives the binary file directly in the 'image' field

Response Format (from N8n)

interface FoodItem {
  name: string;
  quantity: string;     // e.g., "2 patties (4 oz each)", "1 cup"
  calories: number;
  protein: number;      // grams
  carbs: number;        // grams
  fat: number;          // grams
}

interface NutritionResponse {
  output: {
    status: string;     // "success" when valid
    food: FoodItem[];   // array of detected food items
    total: {
      calories: number;
      protein: number;  // grams
      carbs: number;    // grams
      fat: number;      // grams
    };
  };
}

Example Response

{
  "output": {
    "status": "success",
    "food": [
      {
        "name": "Sesame Seed Bun",
        "quantity": "1 sandwich bun",
        "calories": 150,
        "protein": 5,
        "carbs": 28,
        "fat": 2
      },
      {
        "name": "Beef Patty",
        "quantity": "2 patties (4 oz each)",
        "calories": 500,
        "protein": 44,
        "carbs": 0,
        "fat": 36
      }
    ],
    "total": {
      "calories": 650,
      "protein": 49,
      "carbs": 28,
      "fat": 38
    }
  }
}

UI Design Guidelines

Color Palette

- Primary: Green gradient (#22c55e to #16a34a) - health/nutrition theme
- Background: Dark (#0f172a to #1e293b) - modern dark mode
- Cards: Semi-transparent dark (#1e293b with opacity)
- Text: White (#ffffff) and gray (#94a3b8)
- Accents:
  - Protein: Blue (#3b82f6)
  - Carbs: Yellow (#eab308)
  - Fat: Red (#ef4444)

Layout

- Centered single-page app
- Max width: 600px
- Mobile-first responsive design
- Smooth transitions between states (upload -> loading -> results)

States

1. **Initial**: Upload zone visible, no results
2. **Image Selected**: Preview shown, "Analyze" button enabled
3. **Loading**: Spinner/pulse animation, "Analyzing your meal..." - app waits for webhook response
4. **Results**: Hide upload zone, show full nutrition breakdown
5. **Error with Fallback**: If webhook fails, show demo data WITH a yellow warning banner explaining the error (e.g., "Webhook error: Empty response from server - showing demo data")

Component Specifications

ImageUpload

- Props: `onImageSelect(file: File)`, `isLoading`
- Stores selected File object and generates base64 preview separately
- Dashed border zone (2px, rounded-2xl)
- Camera/upload icon centered (use lucide-react Camera icon)
- Text: "Drop your meal photo here" + "or click to upload"
- On hover: border color change, subtle scale
- On drag-over: background highlight, Upload icon
- When image selected: show preview, "Change Photo" and "Analyze Meal" buttons
- Passes the File object (not base64) to onImageSelect

MacroCard

- Icon + label + value layout
- Circular progress or horizontal bar showing % of daily value
- Large number display for grams

FoodBreakdown

- Expandable list of detected foods
- Each item shows: name, quantity (gray subtext), calories, mini macro indicators (P/C/F with colored dots)
- Collapsible with ChevronUp/ChevronDown toggle

NutritionResult

- Props: `data`, `onReset`, `error`, `isMockData`
- Shows error banner at top if `error && isMockData` (yellow background, AlertTriangle icon)
- Error banner shows "Demo Data" title and specific error message
- Total calories display with Flame icon (reads from `data.output.total`)
- Macro cards grid (3 columns)
- Food breakdown list (reads from `data.output.food`)
- "Analyze Another Meal" button to reset

useNutritionAnalysis Hook

Returns: `{ analyzeImage, isLoading, error, result, isMockData, reset }`

- `analyzeImage(file: File)` - sends image as FormData to webhook
- `isLoading` - true while waiting for response
- `error` - error message string or null
- `result` - NutritionResponse or null
- `isMockData` - true when showing fallback demo data
- `reset()` - clears result, error, and isMockData

App Component

- Uses useNutritionAnalysis hook
- Header with Utensils icon, "Cal AI" title, subtitle
- Main card container with rounded corners, semi-transparent background
- Conditionally renders:
  - If `result` exists: show NutritionResult with `data`, `onReset`, `error`, `isMockData`
  - Otherwise: show ImageUpload, and if `isLoading` show spinner with "Analyzing your meal..."
- Footer: "Powered by AI"

Icons (from lucide-react)

- `Camera` - upload zone default icon
- `Upload` - upload zone drag-over icon
- `Flame` - total calories display
- `AlertTriangle` - error/warning banner
- `ChevronUp` / `ChevronDown` - food breakdown toggle
- `Utensils` - app header logo

CSS Requirements

In `src/index.css`, include Tailwind and a custom fade-in animation:

@import "tailwindcss";

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

Quick Start Commands

# Create project
npm create vite@latest cal-ai -- --template react-ts
cd cal-ai

# Install dependencies
npm install tailwindcss @tailwindcss/vite lucide-react

# Configure Tailwind
# Add to vite.config.ts: import tailwindcss from '@tailwindcss/vite'
# Add tailwindcss() to plugins array

# Start dev server
npm run dev

Environment Setup

Create `.env` file:

VITE_WEBHOOK_URL=YOUR_N8N_WEBHOOK_URL_HERE

Important Notes

1. **No authentication needed** - Simple demo app
2. **Image sent as binary** - N8n webhook receives the image as binary data via multipart/form-data (field name: 'image'). Do NOT send as base64.
3. **Wait for response** - App must await the webhook response before showing results. Show loading spinner while waiting.
4. **Error visibility** - When webhook fails, show demo data BUT display a yellow warning banner explaining the error. Never silently fail.
5. **Mock data fallback** - If webhook fails, show randomized mock data with visible error message
6. **Mobile support** - Camera upload should work on mobile devices

Error Handling & Demo Mode

The app must properly wait for the webhook response before showing results. When the webhook fails or is not configured:

1. **Wait for response**: Always await the webhook response - never show results before the request completes
2. **Show error banner**: Display a yellow warning banner at the top of results explaining what went wrong
3. **Fall back to demo data**: Show randomized mock data so the UI is still functional
4. **Error message format**: "Webhook error: [specific error] - showing demo data"

Error scenarios to handle:

- No webhook URL configured
- HTTP error status (4xx, 5xx)
- Empty response from server
- Invalid JSON response
- Response `output.status` is not "success"
- Response missing required fields (`output.total.calories` must be a number)

Sample Mock Data (for testing without N8n)

const mockResponse: NutritionResponse = {
  output: {
    status: "success",
    food: [
      { name: "Grilled Chicken Breast", quantity: "6 oz", calories: 280, protein: 35, carbs: 0, fat: 12 },
      { name: "Brown Rice", quantity: "1 cup cooked", calories: 220, protein: 5, carbs: 45, fat: 2 },
      { name: "Steamed Broccoli", quantity: "1 cup", calories: 55, protein: 4, carbs: 10, fat: 0.5 },
      { name: "Olive Oil Drizzle", quantity: "1 tbsp", calories: 95, protein: 0, carbs: 0, fat: 10.5 }
    ],
    total: {
      calories: 650,
      protein: 44,
      carbs: 55,
      fat: 25
    }
  }
};