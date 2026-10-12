/**
 * Mock assistant response module.
 *
 * Returns a canned response after a simulated delay. This is NOT real AI —
 * it exists so the app runs end-to-end without an API key. Swap this function
 * for a real API call when ready.
 */

const MOCK_RESPONSES: string[] = [
  "Systems are online and operating within normal parameters. How may I assist you today?",
  "I've processed your request. All subsystems report nominal status — no anomalies detected in the current data stream.",
  "Understood. I'm analyzing the situation now. My preliminary assessment suggests a 94.7% probability of optimal outcome.",
  "Acknowledged. I've cross-referenced the available data and prepared a summary for your review.",
  "That's an interesting query. Based on current parameters, I recommend proceeding with caution while I monitor the situation.",
  "I've completed the diagnostic sweep. Everything is functioning at peak efficiency. Is there anything else you'd like me to look into?",
];

let responseIndex = 0;

export function getMockResponse(_userMessage: string): Promise<string> {
  const text = MOCK_RESPONSES[responseIndex % MOCK_RESPONSES.length];
  responseIndex += 1;

  return new Promise((resolve) => {
    setTimeout(() => resolve(text), 900 + Math.random() * 600);
  });
}

export const GREETING_MESSAGE = 'JARVIS online. What do you need?';
