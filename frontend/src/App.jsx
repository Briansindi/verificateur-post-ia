import { useState } from "react";
import { api } from "./api";

export default function App() {
  const [q, setQ] = useState("");
  const [out, setOut] = useState(null);
  const [loading, setLoading] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/api/verify", { question: q });
      setOut(data);
    } catch (e) {
      setOut({ error: e?.response?.data?.error || e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>🔍 Vérificateur post-IA</h1>
      <form onSubmit={send}>
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          rows={4}
          style={{ width: "100%", padding: 12 }}
          placeholder="Pose ta question…"
        />
        <button disabled={loading} style={{ marginTop: 12, padding: "8px 16px" }}>
          {loading ? "Analyse…" : "Envoyer"}
        </button>
      </form>

      {out && (
        <pre style={{ background: "#f6f6f6", padding: 12, marginTop: 16 }}>
          {JSON.stringify(out, null, 2)}
        </pre>
      )}
    </div>
  );
}
