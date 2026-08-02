import type { Scenario } from "@/types/pipeline";

export const scenarios: Scenario[] = [
  { id: "general-conversation", name: "General Conversation", description: "A natural, open-ended exchange that highlights turn-taking and tone.", suggestedPrompt: "What is one small habit that can make a day better?", teachingNotes: ["Listen for natural pacing", "Compare what each architecture exposes"] },
  { id: "customer-support", name: "Customer Support", description: "Resolve a practical issue while keeping the interaction clear and reassuring.", suggestedPrompt: "I received the wrong item. What should I do next?", teachingNotes: ["Notice error recovery", "Identify where context can be lost"] },
  { id: "travel-planning", name: "Travel Planning", description: "Turn preferences and constraints into a concise travel recommendation.", suggestedPrompt: "Help me plan a quiet three-day city break.", teachingNotes: ["Track constraints between stages", "Discuss accumulated latency"] },
  { id: "restaurant-booking", name: "Restaurant Booking", description: "Collect details for a reservation through a short task-focused conversation.", suggestedPrompt: "Book dinner for four near the theater tomorrow.", teachingNotes: ["Observe clarification questions", "Discuss interruption handling"] },
  { id: "language-tutoring", name: "Language Tutoring", description: "Practice spoken language where pronunciation and prosody carry meaning.", suggestedPrompt: "Help me practice ordering coffee in Spanish.", teachingNotes: ["Consider information lost in text", "Listen for expressive feedback"] },
  { id: "technical-interview", name: "Technical Interview", description: "Explain a technical idea while the agent asks targeted follow-up questions.", suggestedPrompt: "Interview me about designing a rate limiter.", teachingNotes: ["Inspect modular debugging points", "Compare conversational flow"] },
];
