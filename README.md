# WatchDecider: Stop Scrolling. Start Watching.

I have built the **WatchDecider** application following your requirements for a fast, modern and decisive movie recommendation experience. It utilizes a **Smart Shuffle Engine** to give you 3 top-tier picks based on your mood, genre, and content type in under 10 seconds.

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed on your system.

### 2. API Key Setup
The app uses the **TMDB (The Movie Database)** API to fetch millions of titles. You will need a free API key:
1.  Go to [TheMovieDB.org](https://www.themoviedb.org/) and create a free account.
2.  Navigate to your Account Settings -> API section.
3.  Request an API Key (Developer).
4.  Once you have it, create a file named `.env` in the project root:
    ```bash
    VITE_TMDB_API_KEY=your_key_here
    ```

### 3. Installation
Run the following command in your terminal within the project directory:
```bash
npm install
```

### 4. Run the App
Start the development server:
```bash
npm run dev
```
Open the provided URL (usually `http://localhost:5173`) in your browser.

## 🎨 Key Features Implemented

### 🕒 The 10-Second Flow
- **Fast Experience:** From the home screen, one tap on **"Decide for Me"** triggers a rapid but high-quality filtering process.
- **Loading State:** A cinematic loading animation (1.5s delay) simulates the heavy lifting of filtering 800k+ titles.

### 🧠 Smart Shuffle Engine
- **Not Random:** Unlike simple randomizers, this engine factors in popularity, high ratings (min 6.5/10), and current trends while respecting your filters.
- **Dynamic "Why This?":** Each card includes a human-like explanation for why it was picked (e.g., "This mind-bending plot will keep you questioning everything until the end").

### 📱 Premium Swipe Interactions
- **Mobile-First Gestures:** Swipe right to **Like** or left to **Dislike** (or use the intuitive buttons).
- **Glassmorphism UI:** A sleek dark theme with glowing text, translucent panels, and vibrant purple gradients.

### ⚙️ Personalized Filters
- **Moods:** Funny, Dark, Emotional, or Mind-Blowing.
- **Genres & Types:** Effortlessly switch between Movies, TV Shows, or Anime.

## 📂 Project Structure
- `src/services/tmdb.js`: The brain of the application where all API logic and shuffle math happens.
- `src/components/RecommendationCard.jsx`: Handles the swipe physics and visual presentation of the 3 result cards.
- `src/components/FilterModal.jsx`: Advanced filtering system with a modern, responsive layout.
- `src/App.jsx`: The main orchestrator for state transitions and the 10-second decision timer.
