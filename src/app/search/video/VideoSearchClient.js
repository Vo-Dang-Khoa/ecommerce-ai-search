"use client";

import { useEffect, useRef, useState } from "react";
import ProductCard from "../../components/ProductCard";

// CÁCH LÀM: thay vì gửi cả video lên Gemini (tốn quota/dung lượng hơn
// nhiều, dễ vượt giới hạn miễn phí — 1 video vài giây đã nặng hơn hẳn 1
// tấm ảnh), trình duyệt tự TRÍCH RA 1 KHUNG HÌNH đại diện (ở giữa video)
// bằng canvas — hoàn toàn miễn phí, không cần thư viện ngoài — rồi gửi
// khung hình đó qua ĐÚNG API /api/search-image (tính năng tìm bằng hình
// ảnh) đã có sẵn. Vẫn là "tìm bằng video" theo nghĩa khách chỉ cần đưa vào
// 1 đoạn video, không cần tự chụp ảnh, nhưng tiết kiệm quota Gemini hơn
// nhiều so với gửi nguyên video.
const MAX_VIDEO_FILE_BYTES = 30 * 1024 * 1024; // 30MB — chỉ xử lý ở trình duyệt, chưa gửi lên server
const MAX_RECORD_MS = 6_000; // quay video mới: tự dừng sau 6 giây

function fileToBase64(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result || "";
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
}

// Trích 1 khung hình đại diện (ở giữa đoạn video) từ 1 URL video (object
// URL của file tải lên, hoặc của đoạn vừa quay) -> trả về 1 Blob ảnh JPEG.
function extractFrameFromVideoUrl(url) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const duration = video.duration || 1;
      const seekTime = Math.min(duration / 2, Math.max(duration - 0.1, 0));
      video.currentTime = seekTime;
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      if (!canvas.width || !canvas.height) {
        reject(new Error("Không đọc được khung hình video."));
        return;
      }
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Không trích được khung hình."))),
        "image/jpeg",
        0.9
      );
    };
    video.onerror = () => reject(new Error("Không đọc được video."));
    video.load();
  });
}

export default function VideoSearchClient() {
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [description, setDescription] = useState("");
  const [results, setResults] = useState(null);

  // Quay video mới bằng camera (giống cách làm ở /search/voice — ghi âm
  // bằng MediaRecorder — nhưng ghi hình thay vì ghi âm).
  const [recording, setRecording] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoPreviewRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimerRef = useRef(null);
  const uploadInputRef = useRef(null);

  useEffect(() => {
    return () => {
      stopCameraStream();
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (cameraOpen && videoPreviewRef.current && streamRef.current) {
      videoPreviewRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  function stopCameraStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function processVideoUrl(url) {
    setLoading(true);
    setError("");
    setResults(null);
    setDescription("");

    try {
      const frameBlob = await extractFrameFromVideoUrl(url);
      setPreviewUrl(URL.createObjectURL(frameBlob));
      await submitFrame(frameBlob);
    } catch {
      setError("Không xử lý được video này, vui lòng thử video khác.");
      setLoading(false);
    }
  }

  async function submitFrame(blob) {
    try {
      const base64Image = await fileToBase64(blob);
      const res = await fetch("/api/search-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image, mimeType: "image/jpeg" }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Có lỗi xảy ra, vui lòng thử lại.");
        return;
      }

      setDescription(data.imageDescription || "");
      setResults(data.matches || []);
    } catch {
      setError("Không thể kết nối tới máy chủ. Kiểm tra mạng và thử lại.");
    } finally {
      setLoading(false);
    }
  }

  function triggerUploadPicker() {
    uploadInputRef.current?.click();
  }

  function handleUploadChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");
    if (!file.type.startsWith("video/")) {
      setError("Vui lòng chọn 1 tệp video.");
      return;
    }
    if (file.size > MAX_VIDEO_FILE_BYTES) {
      setError("Video quá lớn, vui lòng chọn video nhỏ hơn 30MB.");
      return;
    }

    processVideoUrl(URL.createObjectURL(file));
  }

  async function openCameraToRecord() {
    setError("");
    setCameraError("");
    setDescription("");
    setResults(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCameraError("Trình duyệt/thiết bị chưa cấp quyền dùng camera. Hãy cho phép truy cập camera rồi thử lại.");
      } else if (name === "NotFoundError") {
        setCameraError("Không tìm thấy camera trên thiết bị này.");
      } else {
        setCameraError("Không thể mở camera, vui lòng thử lại hoặc dùng cách tải video có sẵn.");
      }
      setCameraOpen(false);
    }
  }

  function closeCamera() {
    stopCameraStream();
    setCameraOpen(false);
    setRecording(false);
  }

  function startRecording() {
    if (!streamRef.current) return;
    const recorder = new MediaRecorder(streamRef.current);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      closeCamera();
      if (blob.size === 0) {
        setError("Không quay được video, vui lòng thử lại.");
        return;
      }
      await processVideoUrl(URL.createObjectURL(blob));
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);

    stopTimerRef.current = setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, MAX_RECORD_MS);
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  return (
    <main className="flex-1 bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <span className="text-sm font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
          🎥 Tìm kiếm bằng Video
        </span>
        <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">
          Tải lên hoặc quay video bánh bạn thích
        </h1>
        <p className="text-gray-600 mb-8">
          AI sẽ trích 1 khung hình từ video và gợi ý sản phẩm tương tự trong cửa hàng.
        </p>

        <input
          ref={uploadInputRef}
          type="file"
          accept="video/*"
          onChange={handleUploadChange}
          className="hidden"
        />

        {!cameraOpen && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <button
              type="button"
              onClick={triggerUploadPicker}
              disabled={loading}
              className="bg-gray-900 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? "Đang phân tích video..." : "🎞️ Tải video có sẵn"}
            </button>
            <button
              type="button"
              onClick={openCameraToRecord}
              disabled={loading}
              className="border border-gray-900 text-gray-900 px-6 py-3 rounded-md font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              🎥 Quay video mới
            </button>
          </div>
        )}

        {cameraError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-6 text-left">
            {cameraError}
          </div>
        )}

        {cameraOpen && (
          <div className="mb-6">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- video xem trước từ camera, không có phụ đề */}
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className="w-full max-w-sm mx-auto rounded-lg border border-gray-200 bg-black"
            />
            <p className="text-xs text-gray-400 mt-2">Quay tối đa {MAX_RECORD_MS / 1000} giây</p>
            <div className="flex gap-3 justify-center mt-4">
              {!recording ? (
                <>
                  <button
                    type="button"
                    onClick={startRecording}
                    className="bg-red-600 text-white px-6 py-2.5 rounded-md font-medium hover:bg-red-700 transition-colors"
                  >
                    ⏺ Bắt đầu quay
                  </button>
                  <button
                    type="button"
                    onClick={closeCamera}
                    className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-md font-medium hover:border-gray-900 hover:text-gray-900 transition-colors"
                  >
                    Huỷ
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="bg-gray-900 text-white px-6 py-2.5 rounded-md font-medium hover:bg-gray-800 transition-colors animate-pulse"
                >
                  ⏹ Dừng quay
                </button>
              )}
            </div>
          </div>
        )}

        {previewUrl && !cameraOpen && (
          <div className="mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- khung hình trích từ video, không phải asset tĩnh */}
            <img
              src={previewUrl}
              alt="Khung hình trích từ video"
              className="w-full max-w-xs mx-auto rounded-lg border border-gray-200"
            />
            <p className="text-xs text-gray-400 mt-2">Khung hình AI đã dùng để tìm kiếm</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-8 text-left">
            {error}
          </div>
        )}

        {description && (
          <div className="bg-gray-50 border border-gray-200 rounded-md px-4 py-3 mb-8 text-left text-sm text-gray-700">
            <span className="font-medium text-gray-900">AI nhìn thấy: </span>
            {description}
          </div>
        )}

        {results && results.length === 0 && !loading && (
          <p className="text-center text-gray-500">
            Không tìm thấy sản phẩm tương tự. Hãy thử video khác hoặc dùng tìm kiếm bằng văn bản.
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
