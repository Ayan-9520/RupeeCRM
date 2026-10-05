import { useState } from "react";
import { Sparkles } from "lucide-react";
import { askRupeeDial } from "@/lib/python-api";

const PROMPTS = [
  "Which lender may fit this LAP profile?",
  "What documents are pending?",
  "Show my leads requiring follow-up today",
  "Which cases haven't moved for 48 hours?",
  "Explain this lender's eligibility policy",
  "Draft WhatsApp follow-up for this customer",
  "Which customers have potential cross-sell?",
];

export function AskRupeeDial() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async (text: string) => {
    const value = text.trim();
    if (value.length < 2) return;
    setBusy(true);
    setQuestion(value);
    try {
      const data = await askRupeeDial(value);
      setAnswer(data.answer);
      setNote(data.note);
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Could not answer");
      setNote("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="assistant" className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-[#10662A]" />
        <h2 className="font-semibold text-[#390A5D]">Ask RupeeDial</h2>
      </div>
      <p className="mt-1 text-xs text-[#5c4d72]">Answers come from your cases. It will not pick or approve a lender.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={busy}
            onClick={() => void ask(prompt)}
            className="rounded-full border border-[#d8ecdd] px-3 py-1.5 text-left text-xs font-semibold text-[#390A5D] hover:bg-[#f5fcf7] disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about your cases"
          className="flex-1 rounded-xl border border-[#d8ecdd] px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void ask(question)}
          className="rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "…" : "Ask"}
        </button>
      </div>
      {answer ? <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-[#f5fcf7] p-3 text-sm text-[#390A5D]">{answer}</pre> : null}
      {note ? <p className="mt-2 text-[11px] text-slate-500">{note}</p> : null}
    </section>
  );
}
