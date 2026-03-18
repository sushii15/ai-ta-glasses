# AI TA Glasses 🔬

An AI-powered teaching assistant for electronics engineering labs. Point your webcam at a breadboard circuit, upload your lab manual, and ask questions — the AI analyzes your circuit in real time and helps you debug it.

## Features

- **Live camera feed** — always-on webcam captures your circuit on every message
- **Lab manual upload** — drag and drop a PDF or TXT lab manual; the AI reads it and cross-references it with what it sees
- **Voice input** — speak your question instead of typing (Chrome/Edge only)
- **Gemini 2.5 Flash** — Google's latest multimodal model analyzes both text and images
- **Futuristic HUD UI** — dark navy/cyan interface designed for lab environments

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Express.js (Node.js)
- **AI:** Google Gemini 2.5 Flash (multimodal — text + image)
- **PDF parsing:** pdfjs-dist
- **Voice:** Web Speech API (browser-native)

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/ai-ta-glasses.git
cd ai-ta-glasses
```

### 2. Get a Gemini API key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a new API key
3. (Optional) Enable billing for higher rate limits — Gemini 2.5 Flash is very affordable

### 3. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and add your key:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Install dependencies

```bash
npm install
```

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) in **Chrome or Edge** (required for voice input and best camera support).

## Usage

1. **Allow camera access** when prompted by the browser
2. **Upload your lab manual** — drag and drop a PDF into the Lab Manual panel on the right
3. **Point your camera** at your breadboard/circuit
4. **Type or speak** your question — e.g. "My LED isn't lighting up" or "What's wrong with this connection?"
5. The AI will analyze the camera image + lab manual + your question and respond

## Notes

- Voice input requires **Chrome or Edge** — Firefox does not support the Web Speech API
- The camera feed is captured as a JPEG on every message sent
- If you hit API quota limits, wait ~1 minute and try again (free tier) or upgrade to a paid plan

## Project Structure

```
ai-ta-glasses/
├── client/               # React frontend
│   └── src/
│       ├── pages/Home.tsx       # Main UI (camera + chat)
│       └── lib/queryClient.ts   # API helpers
├── server/               # Express backend
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # API routes + Gemini integration
│   └── storage.ts        # In-memory message store
├── shared/
│   └── schema.ts         # Shared TypeScript types
├── .env.example          # Environment variable template
└── README.md
```

## License

MIT
