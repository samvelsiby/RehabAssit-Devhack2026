# RehabAssist

A rehabilitation exercise analysis platform using MediaPipe pose detection for real-time form feedback and rep counting.

## Features

- **Real-time pose analysis** using MediaPipe
- **Exercise form scoring** with live feedback
- **Automatic rep counting** for mini squats
- **Live skeleton visualization** in camera feed
- **Physio-client management** system
- **Progress tracking** and analytics

## Technologies

- **React** + **TypeScript** 
- **MediaPipe** for pose detection
- **Supabase** for data storage
- **Tailwind CSS** + **shadcn/ui** for styling
- **Vite** for development

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```
## Environment Setup

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### Getting API Keys

- **Supabase**: Create a project at [supabase.com](https://supabase.com)
- **Gemini API**: Get your key at [Google AI Studio](https://aistudio.google.com/app/apikey)

## Exercise Analysis

Currently supports **Mini Squat Analysis** with:
- State tracking (s1 → s2 → s3)
- Joint angle measurements
- Form validation
- Automatic rep counting
- Real-time voice coaching

**Note**: Gemini API has free tier limits (15 requests/min, 1,500/day). Enable billing for production use.

## Development

- **Dev server**: `http://localhost:8081`
- **Testing**: `npm test`
- **Linting**: `npm run lint`
