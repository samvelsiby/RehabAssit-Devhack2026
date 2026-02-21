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

## Exercise Analysis

Currently supports **Mini Squat Analysis** with:
- State tracking (s1 → s2 → s3)
- Joint angle measurements
- Form validation
- Automatic rep counting

## Development

- **Dev server**: `http://localhost:8081`
- **Testing**: `npm test`
- **Linting**: `npm run lint`