import { useState, useEffect, useRef, useCallback } from "react";

// ─── FONTS via Google ───────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap";
document.head.appendChild(fontLink);

// ─── THEME ──────────────────────────────────────────────────────────────────
const T = {
  bg:       "#0d0d14",
  surface:  "#13131f",
  card:     "#181828",
  border:   "#2a2a45",
  accent:   "#7c6aff",
  accentB:  "#ff6ab0",
  accentC:  "#6affda",
  text:     "#e8e8f8",
  textDim:  "#6b6b9a",
  success:  "#4fffb0",
  warn:     "#ffcc44",
  danger:   "#ff4d6d",
  code:     "#1a1a2e",
};

// ─── SYSTEM PROMPT ──────────────────────────────────────────────────────────
const EXPLAIN_PROMPT = `You are CodeTutor — a friendly, enthusiastic coding teacher for beginners.
When given code, explain it in simple terms like you're talking to a 15-year-old.
Structure your response EXACTLY like this (use these exact headers):

## 🧠 What This Code Does
One paragraph overview.

## 📖 Line-by-Line Breakdown
Explain each important line simply. Use plain language, no jargon.

## 💡 Key Concepts
List 2-4 concepts used in this code and explain each in one sentence.

## ⚠️ Common Mistakes
One or two things beginners often get wrong with this type of code.

## 🎯 Try It Yourself
One small challenge or modification the user can try.

Be warm, encouraging, and use simple analogies. No complex jargon.`;

const QUIZ_PROMPT = `You are CodeTutor. Based on this code and explanation, generate exactly 3 multiple choice questions to test understanding.
Respond ONLY with valid JSON, no markdown, no explanation, just the JSON array:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Why this answer is correct."
  }
]`;

const DOUBT_PROMPT = `You are CodeTutor — a warm, patient coding mentor. Answer this doubt about the code clearly and simply.
Keep it under 150 words. Use a simple analogy if possible. Be encouraging.`;

// ─── HELPERS ────────────────────────────────────────────────────────────────
const callClaude = async (messages, system) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system,
      messages,
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
};

const speak = (text, onEnd) => {
  window.speechSynthesis.cancel();
  const clean = text.replace(/##.*?\n/g, "").replace(/[*`#]/g, "").replace(/\n+/g, " ").trim();
  const utter = new SpeechSynthesisUtterance(clean);
  utter.rate = 0.95; utter.pitch = 1.05; utter.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find(v => /google us english|samantha|karen|female/i.test(v.name));
  if (v) utter.voice = v;
  utter.onend = onEnd || null;
  window.speechSynthesis.speak(utter);
  return utter;
};

// ─── PARTICLE BG ────────────────────────────────────────────────────────────
function ParticleBg() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      color: [T.accent, T.accentB, T.accentC][Math.floor(Math.random() * 3)],
      alpha: Math.random() * 0.5 + 0.1,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(p.alpha * 255).toString(16).padStart(2, "0");
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

// ─── ANIMATED MARKDOWN RENDERER ─────────────────────────────────────────────
function ExplainBlock({ text }) {
  const sections = text.split(/(?=## )/).filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {sections.map((section, si) => {
        const lines = section.split("\n");
        const header = lines[0].replace("## ", "");
        const body = lines.slice(1).join("\n").trim();
        const colors = [T.accent, T.accentB, T.accentC, T.warn, T.success];
        const color = colors[si % colors.length];
        return (
          <div key={si} style={{
            background: `linear-gradient(135deg, ${T.card}, ${T.surface})`,
            border: `1px solid ${color}33`,
            borderLeft: `3px solid ${color}`,
            borderRadius: 12,
            padding: "14px 16px",
            animation: `fadeUp 0.4s ease ${si * 0.1}s both`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 8, fontFamily: "Syne, sans-serif" }}>{header}</div>
            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.75, whiteSpace: "pre-wrap", fontFamily: "Syne, sans-serif" }}>
              {body.split("\n").map((line, li) => (
                <div key={li} style={{ marginBottom: line.startsWith("-") ? 4 : 0 }}>
                  {line.startsWith("-") ? (
                    <span>
                      <span style={{ color }}> ▸ </span>
                      {line.slice(1).trim()}
                    </span>
                  ) : (
                    <span dangerouslySetInnerHTML={{
                      __html: line
                        .replace(/`([^`]+)`/g, `<code style="background:${T.code};color:${T.accentC};padding:1px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:12px">$1</code>`)
                    }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── QUIZ COMPONENT ─────────────────────────────────────────────────────────
function QuizSection({ questions }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const score = submitted ? questions.filter((q, i) => answers[i] === q.correct).length : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.accent, fontFamily: "Syne, sans-serif" }}>🎯 Knowledge Quiz</div>
        {submitted && (
          <div style={{
            padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: score === questions.length ? `${T.success}22` : `${T.warn}22`,
            color: score === questions.length ? T.success : T.warn,
            border: `1px solid ${score === questions.length ? T.success : T.warn}55`,
          }}>
            {score}/{questions.length} Correct!
          </div>
        )}
      </div>

      {questions.map((q, qi) => (
        <div key={qi} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, animation: `fadeUp 0.4s ease ${qi * 0.12}s both` }}>
          <div style={{ fontSize: 13, color: T.text, marginBottom: 12, fontWeight: 600, fontFamily: "Syne, sans-serif" }}>
            <span style={{ color: T.accent, marginRight: 8 }}>Q{qi + 1}.</span>{q.question}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.options.map((opt, oi) => {
              const chosen = answers[qi] === oi;
              const correct = submitted && oi === q.correct;
              const wrong = submitted && chosen && oi !== q.correct;
              return (
                <button key={oi} onClick={() => !submitted && setAnswers(a => ({ ...a, [qi]: oi }))}
                  style={{
                    padding: "10px 14px", borderRadius: 8, textAlign: "left", cursor: submitted ? "default" : "pointer",
                    fontSize: 13, fontFamily: "Syne, sans-serif",
                    background: correct ? `${T.success}22` : wrong ? `${T.danger}22` : chosen ? `${T.accent}22` : T.surface,
                    border: `1px solid ${correct ? T.success : wrong ? T.danger : chosen ? T.accent : T.border}`,
                    color: correct ? T.success : wrong ? T.danger : chosen ? T.accent : T.textDim,
                    transition: "all 0.2s",
                  }}>
                  <span style={{ marginRight: 8, opacity: 0.6 }}>{["A", "B", "C", "D"][oi]}.</span>{opt}
                </button>
              );
            })}
          </div>
          {submitted && (
            <div style={{ marginTop: 10, fontSize: 12, color: T.textDim, fontStyle: "italic", borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
              💡 {q.explanation}
            </div>
          )}
        </div>
      ))}

      {!submitted && Object.keys(answers).length === questions.length && (
        <button onClick={() => setSubmitted(true)} style={{
          padding: "12px", borderRadius: 10, border: "none", cursor: "pointer",
          background: `linear-gradient(135deg, ${T.accent}, ${T.accentB})`,
          color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "Syne, sans-serif",
          boxShadow: `0 4px 20px ${T.accent}44`, transition: "transform 0.2s",
        }}>Submit Answers →</button>
      )}
    </div>
  );
}

// ─── DOUBT CHAT ─────────────────────────────────────────────────────────────
function DoubtChat({ code, explanation }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    try {
      const context = `Here is the code the student is studying:\n\`\`\`\n${code}\n\`\`\`\n\nExplanation given:\n${explanation}\n\nStudent's doubt:`;
      const reply = await callClaude([{ role: "user", content: context + "\n" + input }], DOUBT_PROMPT);
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't connect. Please try again!" }]);
    }
    setLoading(false);
  };

  const speakMsg = (text) => {
    setSpeaking(true);
    speak(text, () => setSpeaking(false));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 320 }}>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: T.textDim, fontSize: 13, marginTop: 40, fontFamily: "Syne, sans-serif" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🙋</div>
            Ask me anything about this code!
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>
            {m.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${T.accent},${T.accentB})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>🤖</div>
            )}
            <div style={{
              maxWidth: "78%", padding: "10px 13px", borderRadius: m.role === "user" ? "14px 3px 14px 14px" : "3px 14px 14px 14px",
              background: m.role === "user" ? `linear-gradient(135deg,${T.accent}33,${T.accentB}22)` : T.card,
              border: `1px solid ${m.role === "user" ? T.accent + "55" : T.border}`,
              fontSize: 13, color: T.text, lineHeight: 1.6, fontFamily: "Syne, sans-serif",
            }}>
              {m.content}
              {m.role === "assistant" && (
                <button onClick={() => speakMsg(m.content)} style={{ display: "block", marginTop: 6, background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 11 }}>
                  {speaking ? "🔊 Speaking..." : "🔊 Listen"}
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${T.accent},${T.accentB})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🤖</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: T.accent, animation: `dotPop 0.9s infinite ${i*0.2}s` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 8, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Type your doubt here..."
          style={{ flex: 1, padding: "10px 13px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, fontFamily: "Syne, sans-serif", outline: "none", caretColor: T.accent }}
        />
        <button onClick={send} disabled={!input.trim() || loading}
          style={{ padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: `linear-gradient(135deg,${T.accent},${T.accentB})`, color: "#fff", fontSize: 13, fontWeight: 700 }}>
          Ask
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function CodeTutor() {
  const [screen, setScreen] = useState("home"); // home | explain | loading
  const [code, setCode] = useState("");
  const [lang, setLang] = useState("auto");
  const [explanation, setExplanation] = useState("");
  const [quiz, setQuiz] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("explain"); // explain | quiz | doubt
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");

  const LANGS = ["auto", "Python", "JavaScript", "Java", "C", "C++", "HTML", "CSS", "SQL", "Kotlin"];

  const handleExplain = async () => {
    if (!code.trim()) return;
    setScreen("loading");
    setError("");
    try {
      const prompt = `Language: ${lang === "auto" ? "detect automatically" : lang}\n\nCode:\n\`\`\`\n${code}\n\`\`\``;
      const result = await callClaude([{ role: "user", content: prompt }], EXPLAIN_PROMPT);
      setExplanation(result);
      setQuiz(null);
      setActiveTab("explain");
      setScreen("explain");
    } catch (e) {
      setError("Connection failed. Please try again.");
      setScreen("home");
    }
  };

  const generateQuiz = async () => {
    setQuizLoading(true);
    try {
      const prompt = `Code:\n\`\`\`\n${code}\n\`\`\`\n\nExplanation:\n${explanation}`;
      const raw = await callClaude([{ role: "user", content: prompt }], QUIZ_PROMPT);
      const clean = raw.replace(/```json|```/g, "").trim();
      setQuiz(JSON.parse(clean));
      setActiveTab("quiz");
    } catch {
      setQuiz([]);
    }
    setQuizLoading(false);
  };

  const handleSpeak = () => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    setSpeaking(true);
    speak(explanation, () => setSpeaking(false));
  };

  // ── HOME ──
  if (screen === "home") return (
    <div style={{ minHeight: "100vh", background: T.bg, position: "relative", overflow: "hidden", fontFamily: "Syne, sans-serif" }}>
      <ParticleBg />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto", padding: "32px 20px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36, animation: "fadeDown 0.6s ease" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🧑‍💻</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0, background: `linear-gradient(135deg,${T.accent},${T.accentB},${T.accentC})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            CodeTutor AI
          </h1>
          <p style={{ color: T.textDim, fontSize: 14, margin: "8px 0 0", letterSpacing: 0.5 }}>
            Paste any code. Understand everything instantly.
          </p>
        </div>

        {/* Features */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 28 }}>
          {[
            { icon: "🔍", label: "Line-by-line", desc: "Explanation" },
            { icon: "🎯", label: "Quiz Mode", desc: "Test yourself" },
            { icon: "🙋", label: "Ask Doubts", desc: "AI answers" },
            { icon: "🔊", label: "Voice Read", desc: "Listen along" },
            { icon: "💡", label: "Key Concepts", desc: "Learn fast" },
            { icon: "⚠️", label: "Catch Mistakes", desc: "Before they happen" },
          ].map((f, i) => (
            <div key={i} style={{
              background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 10px", textAlign: "center",
              animation: `fadeUp 0.4s ease ${i * 0.07}s both`,
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{f.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{f.label}</div>
              <div style={{ fontSize: 10, color: T.textDim }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Language selector */}
        <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {LANGS.map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${lang === l ? T.accent : T.border}`,
              background: lang === l ? `${T.accent}22` : "transparent",
              color: lang === l ? T.accent : T.textDim,
              transition: "all 0.2s", fontFamily: "Syne, sans-serif",
            }}>{l}</button>
          ))}
        </div>

        {/* Code input */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <textarea value={code} onChange={e => setCode(e.target.value)}
            placeholder={`# Paste your code here...\ndef greet(name):\n    print("Hello, " + name)\n\ngreet("World")`}
            rows={11}
            style={{
              width: "100%", padding: "16px", background: T.code, border: `1px solid ${T.border}`,
              borderRadius: 14, color: T.accentC, fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
              resize: "vertical", outline: "none", lineHeight: 1.7, caretColor: T.accent,
              boxSizing: "border-box", transition: "border-color 0.2s",
            }}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border}
          />
          {code && (
            <button onClick={() => setCode("")} style={{
              position: "absolute", top: 10, right: 10, background: `${T.danger}22`,
              border: `1px solid ${T.danger}44`, color: T.danger, borderRadius: 6,
              padding: "3px 8px", fontSize: 11, cursor: "pointer",
            }}>Clear</button>
          )}
        </div>

        {error && <div style={{ color: T.danger, fontSize: 13, marginBottom: 12, textAlign: "center" }}>{error}</div>}

        <button onClick={handleExplain} disabled={!code.trim()} style={{
          width: "100%", padding: "15px", borderRadius: 12, border: "none", cursor: code.trim() ? "pointer" : "not-allowed",
          background: code.trim() ? `linear-gradient(135deg,${T.accent},${T.accentB})` : T.surface,
          color: code.trim() ? "#fff" : T.textDim, fontSize: 15, fontWeight: 800,
          fontFamily: "Syne, sans-serif", letterSpacing: 0.5,
          boxShadow: code.trim() ? `0 4px 24px ${T.accent}44` : "none",
          transition: "all 0.3s", transform: code.trim() ? "translateY(0)" : "none",
        }}>
          ✨ Explain This Code
        </button>

        <p style={{ textAlign: "center", color: T.textDim, fontSize: 11, marginTop: 16 }}>
          Supports Python, JS, Java, C, C++, HTML, SQL & more
        </p>
      </div>
      <Styles />
    </div>
  );

  // ── LOADING ──
  if (screen === "loading") return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, fontFamily: "Syne, sans-serif" }}>
      <ParticleBg />
      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <div style={{ fontSize: 52, animation: "spin 1.5s linear infinite", marginBottom: 16 }}>⚙️</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.accent, marginBottom: 8 }}>Analysing your code...</div>
        <div style={{ fontSize: 13, color: T.textDim }}>Breaking it down into simple steps</div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 20 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent, animation: `dotPop 1s infinite ${i*0.2}s` }} />)}
        </div>
      </div>
      <Styles />
    </div>
  );

  // ── EXPLANATION SCREEN ──
  const TABS = [
    { id: "explain", label: "📖 Explanation" },
    { id: "quiz", label: "🎯 Quiz" },
    { id: "doubt", label: "🙋 Ask Doubt" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "Syne, sans-serif", position: "relative" }}>
      <ParticleBg />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "20px 16px 40px" }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={() => setScreen("home")} style={{ background: T.card, border: `1px solid ${T.border}`, color: T.textDim, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12 }}>
            ← Back
          </button>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.accent }}>CodeTutor AI</div>
          <button onClick={handleSpeak} style={{
            background: speaking ? `${T.accentB}22` : T.card,
            border: `1px solid ${speaking ? T.accentB : T.border}`,
            color: speaking ? T.accentB : T.textDim,
            borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12,
          }}>
            {speaking ? "⏹ Stop" : "🔊 Listen"}
          </button>
        </div>

        {/* Code preview */}
        <div style={{ background: T.code, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, maxHeight: 120, overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: T.textDim, marginBottom: 6, letterSpacing: 1 }}>YOUR CODE</div>
          <pre style={{ margin: 0, fontSize: 12, color: T.accentC, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{code}</pre>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, background: T.card, padding: 6, borderRadius: 12, border: `1px solid ${T.border}` }}>
          {TABS.map(tab => (
            <button key={tab.id}
              onClick={() => {
                if (tab.id === "quiz" && !quiz && !quizLoading) generateQuiz();
                setActiveTab(tab.id);
              }}
              style={{
                flex: 1, padding: "9px 6px", borderRadius: 8, border: "none", cursor: "pointer",
                background: activeTab === tab.id ? `linear-gradient(135deg,${T.accent},${T.accentB})` : "transparent",
                color: activeTab === tab.id ? "#fff" : T.textDim,
                fontSize: 12, fontWeight: 700, fontFamily: "Syne, sans-serif",
                transition: "all 0.25s",
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "explain" && <ExplainBlock text={explanation} />}

        {activeTab === "quiz" && (
          <div>
            {quizLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: T.textDim }}>
                <div style={{ fontSize: 32, animation: "spin 1s linear infinite", marginBottom: 12 }}>⚙️</div>
                <div>Generating quiz questions...</div>
              </div>
            ) : quiz && quiz.length > 0 ? (
              <QuizSection questions={quiz} />
            ) : (
              <div style={{ textAlign: "center", padding: 40 }}>
                <button onClick={generateQuiz} style={{ padding: "12px 28px", borderRadius: 10, border: "none", cursor: "pointer", background: `linear-gradient(135deg,${T.accent},${T.accentB})`, color: "#fff", fontSize: 14, fontWeight: 700 }}>
                  Generate Quiz
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "doubt" && <DoubtChat code={code} explanation={explanation} />}
      </div>
      <Styles />
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
      @keyframes fadeDown { from{opacity:0;transform:translateY(-18px)} to{opacity:1;transform:translateY(0)} }
      @keyframes dotPop { 0%,100%{opacity:0.3;transform:scale(0.7)} 50%{opacity:1;transform:scale(1.3)} }
      @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      textarea { transition: border-color 0.2s; }
      textarea::placeholder { color: #3a3a5a; }
      input::placeholder { color: #3a3a5a; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-thumb { background: #2a2a45; border-radius: 4px; }
    `}</style>
  );
}
