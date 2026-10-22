import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

export default function UploadDialog({ clients, onClose, onDone, defaultClient = "" }) {
  const [file, setFile] = useState(null);
  const [client, setClient] = useState(defaultClient);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const pick = (f) => {
    if (f && !f.name.toLowerCase().endsWith(".pdf")) return setErr("Only PDF files can be uploaded.");
    setErr("");
    setFile(f || null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const created = await api.upload(file, client.trim());
      onDone(created);
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim" onClick={() => !busy && onClose()} />
      <form className="dialog" role="dialog" aria-modal="true" aria-label="Upload a contract" onSubmit={submit}>
        <h2>Upload a contract</h2>
        <p className="lede">The PDF is saved to your local inbox folder and read right away.</p>

        <div
          className={`drop ${over ? "over" : ""} ${file ? "has" : ""}`}
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => (e.preventDefault(), setOver(false), pick(e.dataTransfer.files?.[0]))}
          onClick={() => input.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
        >
          {file ? <strong>{file.name}</strong> : <span>Drop a PDF here, or choose a file</span>}
          <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => pick(e.target.files?.[0])} />
        </div>

        <label className="stack">
          <span>Client</span>
          <input list="client-names" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Leave blank to use the client named in the contract" />
          <datalist id="client-names">
            {clients.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </label>

        {err && <p className="form-err">{err}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={!file || busy}>
            {busy ? "Reading contract" : "Upload and extract"}
          </button>
        </div>
      </form>
    </>
  );
}
