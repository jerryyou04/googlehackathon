"use client";

import { useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";

const PRESET_QUESTIONS = [
  "Where am I overspending?",
  "What are my top 5 merchants?",
  "How does this month compare to last month?",
  "What's my average daily spend?",
  "Which category costs me the most?",
  "Do I have any recurring charges?",
  "What are my biggest single expenses?",
  "How much do I spend on food?",
];

export default function InsightsChat() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setAnswer(null);
    setError(null);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setAnswer(data.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get answer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-[#E2E8E4] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-[#00A651]" />
        <h2 className="font-semibold text-[#1a3a2a] text-sm">Ask Gemini about your spending</h2>
      </div>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PRESET_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => { setQuestion(q); ask(q); }}
            className="text-xs bg-[#F0F5F2] text-[#1a3a2a] px-3 py-1.5 rounded-full hover:bg-[#DDE8E1] transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(question)}
          placeholder="Ask anything about your spending…"
          className="flex-1 border border-[#DDE8E1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00A651]"
        />
        <button
          onClick={() => ask(question)}
          disabled={loading || !question.trim()}
          className="bg-[#00A651] text-white rounded-xl px-3 py-2 hover:bg-[#007A3E] disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 size={14} className="animate-spin text-[#00A651]" />
          Analysing your transactions…
        </div>
      )}

      {/* Answer */}
      {answer && (
        <div className="mt-3 bg-[#F0FFF4] border border-[#86efac] rounded-xl p-3">
          <p className="text-xs font-semibold text-[#00A651] mb-1">AI Response</p>
          <p className="text-sm text-[#1a3a2a] whitespace-pre-line">{answer}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
