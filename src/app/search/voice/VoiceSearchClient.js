"use client";

import { useRef, useState } from "react";
import ProductCard from "../../components/ProductCard";

// Ghi âm bằng MediaRecorder — API này được hỗ trợ RỘNG RÃI trên mọi trình
// duyệt hiện đại (Chrome, Edge, Safari, Firefox — cả máy tính lẫn điện
// thoại), khác với Web Speech API (SpeechRecognition) trước đây CHỈ chạy
// tốt trên Chrome/Edge. File âm thanh ghi được gửi thẳng lên
// /api/search-voice để Gemini vừa "nghe hiểu" vừa chọn sản phẩm phù hợp —
// không cần chuyển giọng nói -> văn bản ở phía trình duyệt nữa.
const MAX_RECORD_MS = 20_000; // tự dừng sau 20 giây để tránh ghi âm quá dài

// Base64 hoá Blob bằng FileReader — chạy được trên mọi trình duyệt, không
// cần thư viện ngoài.
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result || "";
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Thử theo thứ tự ưu tiên các định dạng Gemini hỗ trợ tốt — trình duyệt sẽ
// tự chọn định dạng đầu tiên nó hỗ trợ (nếu không cái nào khớp, để trống
// cho trình duyệt tự quyết định định dạng mặc định).
const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
];

function pickSupportedMimeType() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export default function VoiceSearchClient() {
  const [supported] = useState(
    () =>
      typeof window !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined"
  );
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [results, setResults] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const stopTimerRef = useRef(null);

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }

  async function startRecording() {
    setMicError("");
    setSearchError("");
    setTranscript("");
    setResults(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        cleanupStream();
        setRecording(false);

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        if (blob.size === 0) {
          setMicError("Không ghi được âm thanh, vui lòng thử lại.");
          return;
        }
        await submitRecording(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);

      // Tự động dừng sau MAX_RECORD_MS để tránh ghi âm quá dài (vừa tốn
      // quota Gemini, vừa dễ vượt giới hạn dung lượng cho phép).
      stopTimerRef.current = setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, MAX_RECORD_MS);
    } catch (err) {
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        setMicError("Trình duyệt/thiết bị chưa cấp quyền dùng micro. Hãy cho phép truy cập micro rồi thử lại.");
      } else if (err?.name === "NotFoundError") {
        setMicError("Không tìm thấy micro trên thiết bị này.");
      } else {
        setMicError("Không thể bắt đầu ghi âm, vui lòng thử lại.");
      }
      setRecording(false);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  async function submitRecording(blob) {
    setLoading(true);
    setSearchError("");
    setResults(null);

    try {
      const base64Audio = await blobToBase64(blob);
      const res = await fetch("/api/search-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64Audio, mimeType: blob.type }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSearchError(data.error || "Có lỗi xảy ra, vui lòng thử lại.");
        return;
      }

      setTranscript(data.transcript || "");
      setResults(data.matches || []);
    } catch {
      setSearchError("Không thể kết nối tới máy chủ. Kiểm tra mạng và thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <span className="text-sm font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
          🎤 Tìm kiếm bằng giọng nói
        </span>
        <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">
          Nói mô tả bánh bạn cần
        </h1>
        <p className="text-gray-600 mb-8">
          Bấm nút micro, nói yêu cầu của bạn (vd &quot;bánh sinh nhật vị chocolate cho tiệc
          nhỏ&quot;), rồi bấm dừng — AI sẽ tự nghe và tìm sản phẩm phù hợp. Chạy được trên mọi
          trình duyệt, cả máy tính lẫn điện thoại.
        </p>

        {!supported ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-md px-4 py-4">
            Trình duyệt hoặc thiết bị hiện tại không hỗ trợ ghi âm. Vui lòng cập nhật trình
            duyệt lên phiên bản mới nhất, hoặc chuyển sang{" "}
            <a href="/search" className="underline">
              tìm kiếm bằng văn bản
            </a>
            .
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={loading}
              className={`w-24 h-24 rounded-full text-4xl flex items-center justify-center mx-auto mb-4 transition-colors disabled:opacity-50 ${
                recording
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-gray-900 text-white hover:bg-gray-800"
              }`}
              aria-label={recording ? "Dừng ghi âm" : "Bắt đầu ghi âm"}
            >
              {recording ? "⏹" : "🎤"}
            </button>
            <p className="text-sm text-gray-500 mb-6">
              {loading
                ? "AI đang nghe và tìm sản phẩm..."
                : recording
                ? "Đang ghi âm... bấm lại để dừng (tự dừng sau 20 giây)"
                : "Bấm để bắt đầu nói"}
            </p>

            {micError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-6 text-left">
                {micError}
              </div>
            )}
          </>
        )}

        {searchError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-8 text-left">
            {searchError}
          </div>
        )}

        {transcript && (
          <div className="bg-gray-50 border border-gray-200 rounded-md px-4 py-3 mb-8 text-left text-sm text-gray-700">
            <span className="font-medium text-gray-900">AI nghe được: </span>
            &quot;{transcript}&quot;
            <div className="mt-2">
              <a
                href={`/search?q=${encodeURIComponent(transcript)}`}
                className="text-amber-700 hover:underline text-xs"
              >
                Không đúng ý bạn? Sửa lại bằng tìm kiếm văn bản →
              </a>
            </div>
          </div>
        )}

        {results && results.length === 0 && !loading && (
          <p className="text-center text-gray-500">
            Không tìm thấy sản phẩm phù hợp. Hãy thử nói lại rõ hơn.
          </p>
        )}
      </div>

      {results && results.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 pb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {results.map(({ product, reason }) => (
              <ProductCard key={product.id} product={product} reason={reason} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
