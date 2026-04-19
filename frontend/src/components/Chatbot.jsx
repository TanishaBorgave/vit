import { useState, useRef, useEffect } from "react";
import axios from "axios";

export default function Chatbot() {
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hi 👋 I’m your GST AI Assistant. Ask me anything!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasAsked, setHasAsked] = useState(false);

  const chatRef = useRef(null);

  // Auto scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userText = input;
    setInput("");

    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setHasAsked(true);
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:5001/api/ai/chat", {
        query: userText,
      });

      setMessages((prev) => [
        ...prev,
        { role: "bot", text: res.data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "⚠️ Error fetching response" },
      ]);
    }

    setLoading(false);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-full shadow-lg hover:scale-110 transition-all duration-200"
      >
        💬
      </button>

      {/* Chat Window */}
      {open && (
        <div className="h-[75%] fixed bottom-20 right-6 w-96 backdrop-blur-xl bg-white/80 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden border border-white/20">

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-4 flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-lg">GST AI Assistant</h2>
              <p className="text-xs opacity-80">Smart insights & compliance help</p>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center"
            >
              ✕
            </button>
          </div>

          {/* ✅ FLEXIBLE CHAT AREA (FIXED) */}
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`px-4 py-2 rounded-2xl max-w-[75%] text-sm ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                      : "bg-white shadow border"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="text-sm text-gray-500 animate-pulse">
                🤖 Thinking...
              </div>
            )}
          </div>

          {/* Suggestions (ONLY FIRST TIME) */}
          {!hasAsked && (
            <div className="px-4 py-3 border-t bg-white/80">
              <p className="text-xs text-gray-500 mb-2">💡 Try asking:</p>

              <div className="grid gap-2 text-xs">
                <div
                  onClick={() => setInput("Which type of mismatch is most common in GST reconciliation?")}
                  className="bg-gray-100 hover:bg-blue-50 px-3 py-2 rounded-lg cursor-pointer transition border"
                >
                  • Which type of mismatch is most common in GST reconciliation?
                </div>

                <div
                  onClick={() => setInput("How do timing differences between GSTR-1 and GSTR-2B affect reconciliation?")}
                  className="bg-gray-100 hover:bg-blue-50 px-3 py-2 rounded-lg cursor-pointer transition border"
                >
                  • How do timing differences between GSTR-1 and GSTR-2B affect reconciliation?
                </div>

                <div
                  onClick={() => setInput("How can I prioritize reconciliation tasks efficiently?")}
                  className="bg-gray-100 hover:bg-blue-50 px-3 py-2 rounded-lg cursor-pointer transition border"
                >
                  • How can I prioritize reconciliation tasks efficiently?
                </div>

                <div
                  onClick={() => setInput("Which compliance errors can lead to penalties?")}
                  className="bg-gray-100 hover:bg-blue-50 px-3 py-2 rounded-lg cursor-pointer transition border"
                >
                  • Which compliance errors can lead to penalties?
                </div>
              </div>
              </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 p-3 border-t bg-white">
            <input
              type="text"
              placeholder="Ask something..."
              className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />

            <button
              onClick={sendMessage}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-full"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}