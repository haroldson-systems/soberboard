import React, { useRef, useState } from "react";
import { Camera, Trash2, Loader2, ImageOff } from "lucide-react";
import api, { API_BASE, formatApiError } from "@/lib/api";

const MAX_IMAGES = 6;
const MAX_BYTES = 8 * 1024 * 1024;

function publicUrl(path) {
  // Cloudinary and other absolute URLs pass through unchanged
  if (path && (path.startsWith("http://") || path.startsWith("https://"))) return path;
  // Fallback for any relative paths still in the DB
  return `${API_BASE}/files/${path}`;
}

export default function ImageUploader({ value = [], onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const addFiles = async (files) => {
    setError("");
    const next = [...value];
    for (const f of files) {
      if (next.length >= MAX_IMAGES) break;
      if (!f.type.startsWith("image/")) {
        setError("Only image files are allowed.");
        continue;
      }
      if (f.size > MAX_BYTES) {
        setError(`${f.name} is over 8 MB — please pick a smaller image.`);
        continue;
      }
      try {
        setBusy(true);
        const fd = new FormData();
        fd.append("file", f);
        const r = await api.post("/uploads/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
        next.push(r.data.url);
        onChange([...next]);
      } catch (err) {
        setError(formatApiError(err.response?.data?.detail) || "Upload failed");
        break;
      } finally {
        setBusy(false);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (idx) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div data-testid="image-uploader">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {value.map((path, idx) => (
          <div key={path} className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-[#EAE5D9] bg-[#F3EFE7] group" data-testid={`uploaded-image-${idx}`}>
            <img
              src={publicUrl(path)}
              alt={`Upload ${idx + 1}`}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 backdrop-blur text-white grid place-items-center opacity-0 group-hover:opacity-100 transition"
              data-testid={`remove-image-${idx}`}
              aria-label="Remove image"
            >
              <Trash2 size={14}/>
            </button>
            {idx === 0 && (
              <span className="absolute bottom-2 left-2 bg-white/95 text-[#2D3339] text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full font-semibold">Cover</span>
            )}
          </div>
        ))}

        {value.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="aspect-[4/3] rounded-2xl border-2 border-dashed border-[#EAE5D9] hover:border-[#C26D53] text-[#5C6670] hover:text-[#C26D53] transition flex flex-col items-center justify-center gap-1.5 bg-white"
            data-testid="add-image-btn"
          >
            {busy ? <Loader2 size={22} className="animate-spin"/> : <Camera size={22} strokeWidth={1.6}/>}
            <span className="text-sm font-medium">{busy ? "Uploading…" : "Add photo"}</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#8A94A0]">{value.length} / {MAX_IMAGES}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(Array.from(e.target.files || []))}
        data-testid="image-uploader-input"
      />

      <p className="text-xs text-[#8A94A0] mt-3 flex items-center gap-1.5">
        <ImageOff size={12}/> JPG, PNG, WEBP, or HEIC · up to 8 MB each · the first photo is your cover
      </p>
      {error && <p className="text-sm text-[#C26D53] mt-2" data-testid="image-uploader-error">{error}</p>}
    </div>
  );
}

export { publicUrl };
