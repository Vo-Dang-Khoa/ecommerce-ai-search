"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Nút "Quay Video mới" — mở camera (kèm micro) NGAY TRONG trang và quay
 * video bằng MediaRecorder, tự dừng khi đạt `maxSeconds`. Video quay xong
 * được đưa ra ngoài qua onRecorded(file) để trang cha xử lý tiếp (kiểm tra
 * dung lượng/thời lượng, tự nén nếu cần — xem handleIncomingVideo ở
 * page.js), KHÔNG tự upload ở đây.
 *
 * @param {{disabled?: boolean, maxSeconds: number, onRecorded: (file: File) => void}} props
 */
export default function RecordVideoButton({ disabled, maxSeconds, onRecorded }) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [recording, setRecording] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      stopCameraStream();
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  function stopCameraStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function openCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCameraError(
          "Trình duyệt/thiết bị chưa cấp quyền dùng camera/micro. Hãy cho phép truy cập rồi thử lại."
        );
      } else if (name === "NotFoundError") {
        setCameraError("Không tìm thấy camera/micro trên thiết bị này.");
      } else if (name === "NotReadableError") {
        setCameraError(
          "Camera/micro đang được ứng dụng khác sử dụng, vui lòng đóng ứng dụng đó rồi thử lại."
        );
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
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }

  function startRecording() {
    if (!streamRef.current) return;
    const recorder = new MediaRecorder(streamRef.current);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      closeCamera();
      if (blob.size === 0) {
        setCameraError("Không quay được video, vui lòng thử lại.");
        return;
      }
      const ext = (recorder.mimeType || "video/webm").includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `record-${Date.now()}.${ext}`, {
        type: recorder.mimeType || "video/webm",
      });
      onRecorded(file);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);

    stopTimerRef.current = setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, maxSeconds * 1000);
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  return (
    <>
      {!cameraOpen && (
        <button
          type="button"
          onClick={openCamera}
          disabled={disabled}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md border border-gray-900 text-gray-900 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          🎥 Quay video mới
        </button>
      )}

      {cameraError && <p className="text-xs text-red-600 mt-1.5">{cameraError}</p>}

      {cameraOpen && (
        <div className="mb-4">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- video xem trước từ camera, không có phụ đề */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-w-sm mx-auto rounded-lg border border-gray-200 bg-black"
          />
          <p className="text-xs text-gray-400 text-center mt-2">Quay tối đa {maxSeconds} giây</p>
          <div className="flex gap-3 justify-center mt-3">
            {!recording ? (
              <>
                <button
                  type="button"
                  onClick={startRecording}
                  className="bg-red-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  ⏺ Bắt đầu quay
                </button>
                <button
                  type="button"
                  onClick={closeCamera}
                  className="border border-gray-300 text-gray-700 px-5 py-2 rounded-md text-sm font-medium hover:border-gray-900 hover:text-gray-900 transition-colors"
                >
                  Huỷ
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="bg-gray-900 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors animate-pulse"
              >
                ⏹ Dừng quay
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
