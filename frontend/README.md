# JARVIS — AI Assistant

A futuristic, JARVIS-inspired AI assistant web app built with React, Vite, TypeScript, and Tailwind CSS. Features a cinematic dark navy/black interface with cyan-blue glowing accents, an animated AI orb centerpiece, voice input/output, and a full chat experience.

> **Note:** The assistant runs in **mock mode** — responses are simulated, not from a real AI. This lets the app run without any API key. See `src/lib/mockAssistant.ts` to swap in a real API.

## Getting Started

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal.

To create a production build:

```bash
npm run build
npm run preview
```

## Features

- **Animated AI Orb** — Four visual states: idle, listening, thinking, and speaking. Ambient rotation runs continuously.
- **Chat Interface** — User and assistant message bubbles with fade-in animations and hover action controls (copy, read aloud).
- **Typing Indicator** — Three pulsing dots while the assistant prepares a response.
- **Collapsible Sidebar** — New Conversation button and full conversation history, saved to localStorage.
- **Voice Input** — Microphone button using the Web Speech API with a pulsing ring animation while listening.
- **Text-to-Speech** — Browser SpeechSynthesis API to read responses aloud. Toggle "Auto Voice" for automatic spoken replies.
- **Conversation History** — All conversations persist in localStorage across page reloads.
- **Responsive Design** — Works on desktop and mobile with a slide-in sidebar on smaller screens.
- **Accessibility** — Keyboard focus indicators, ARIA labels, and `prefers-reduced-motion` support.

## Project Structure

```
src/
├── App.tsx                       # Main app — orchestrates all components and state
├── types.ts                      # Shared TypeScript types (Message, Conversation, OrbState)
├── index.css                     # Global styles, glassmorphism utilities, animations
├── lib/
│   └── mockAssistant.ts          # Mock response generator (replace with real API)
├── hooks/
│   ├── useChat.ts                # Chat message state and assistant response flow
│   ├── useConversations.ts       # Conversation CRUD + localStorage persistence
│   ├── useSpeechRecognition.ts   # Web Speech API voice input wrapper
│   └── useSpeechSynthesis.ts     # SpeechSynthesis text-to-speech wrapper
└── components/
    ├── AIOrb.tsx                 # Animated orb centerpiece (Framer Motion)
    ├── ChatInput.tsx             # Message input, mic button, send button
    ├── ChatMessage.tsx           # Individual message bubble with action controls
    ├── Header.tsx                # Top bar with sidebar toggle and status
    ├── Sidebar.tsx               # Conversation list and new chat button
    └── TypingIndicator.tsx       # Animated typing dots
```

## How Components Work

- **App.tsx** — Wires together all hooks and components. Manages sidebar state, input value, auto-speak toggle, and determines the orb's current state from listening/thinking/speaking flags.
- **AIOrb.tsx** — A multi-layered animated orb using Framer Motion. Outer and inner rings rotate at different speeds; the core pulses and changes color based on state. Listening adds expanding pulse rings; thinking adds a rotating indicator.
- **Sidebar.tsx** — Slide-in panel with conversation history. Each item highlights on hover and shows a delete button on hover. On mobile, a backdrop overlay appears.
- **ChatMessage.tsx** — Renders user or assistant bubbles with fade-in animation. On hover, action controls appear: copy to clipboard and read aloud (assistant only).
- **ChatInput.tsx** — Auto-resizing textarea with a mic button (pulsing ring while listening) and a send button. Focus state adds a cyan border glow.
- **TypingIndicator.tsx** — Three dots that pulse in sequence while the assistant is "thinking."
- **Header.tsx** — Top bar with sidebar toggle, JARVIS title, online status indicator, and a settings icon with a rotation hover animation.

## Hooks

- **useChat** — Manages messages array, thinking state, and error handling. Calls `getMockResponse()` to get simulated replies.
- **useConversations** — Manages conversation list with localStorage persistence. Auto-creates a new conversation with a greeting message on first load. Derives conversation titles from the first user message.
- **useSpeechRecognition** — Wraps the Web Speech API. Handles interim and final transcripts, errors (permission denied, unsupported), and lifecycle.
- **useSpeechSynthesis** — Wraps the SpeechSynthesis API. Selects a preferred English voice and exposes `speak()`, `cancel()`, and `isSpeaking`.

## Customization

### Replacing Mock Responses

Edit `src/lib/mockAssistant.ts` and replace `getMockResponse()` with a call to your AI API (OpenAI, Anthropic, etc.):

```typescript
export async function getMockResponse(userMessage: string): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMessage }),
  });
  const data = await res.json();
  return data.reply;
}
```

### Theme Colors

Colors are defined in `tailwind.config.js` under the `jarvis` color namespace. Adjust the cyan, blue, and background shades there.

## Browser Support

- **Voice input** (SpeechRecognition): Chrome, Edge, and other Chromium browsers. Firefox and Safari have limited or no support — the mic button shows as disabled with a clear indicator.
- **Text-to-speech** (SpeechSynthesis): Widely supported across modern browsers.

## Tech Stack

- React 18 + TypeScript
- Vite (build tool / dev server)
- Tailwind CSS (styling)
- Framer Motion (animations)
- Lucide React (icons)
