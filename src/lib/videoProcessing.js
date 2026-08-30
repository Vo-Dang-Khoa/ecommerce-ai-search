// Cắt bớt / giảm dung lượng video NGAY TRÊN TRÌNH DUYỆT — không dùng thư
// viện ngoài (như ffmpeg.wasm — nặng ~25-30MB, dễ chậm/treo trên điện
// thoại yếu), chỉ dùng 2 API có sẵn của trình duyệt:
//   1. <video>.captureStream() — lấy lại luồng hình + tiếng đang PHÁT của
//      1 thẻ <video> dưới dạng MediaStream.
//   2. MediaRecorder — ghi lại đúng luồng đó thành 1 file video mới, có
//      thể chỉ ghi 1 đoạn thời gian (= CẮT video) và/hoặc ghi ở bitrate
//      thấp hơn bản gốc (= NÉN video, giảm dung lượng).
//
// Đánh đổi: quá trình ghi lại chạy theo thời gian THỰC (ghi lại 1 đoạn 30
// giây thì mất khoảng 30 giây xử lý) vì phải phát video qua rồi "quay"
// lại, không nén nhanh như phần mềm chuyên dụng. Chấp nhận được cho đồ án
// demo — đổi lại hoàn toàn miễn phí, không cần tải thêm thư viện nặng.
//
// LƯU Ý TƯƠNG THÍCH: captureStream() chưa được TẤT CẢ trình duyệt hỗ trợ
// (đặc biệt 1 số bản Safari cũ) — luôn gọi isVideoReencodeSupported()
// trước, nếu false thì phải quay lại cách cũ: báo lỗi + hướng dẫn người
// dùng tự cắt/nén video bằng ứng dụng có sẵn trên thiết bị.

const CANDIDATE_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

function getVideoCaptureStream(video) {
  if (typeof video.captureStream === "function") return video.captureStream();
  if (typeof video.mozCaptureStream === "function") return video.mozCaptureStream();
  return null;
}

/**
 * Kiểm tra trình duyệt hiện tại có hỗ trợ cắt/nén video tự động hay không.
 * Luôn gọi hàm này TRƯỚC khi dùng reencodeVideoSegment/autoCompressVideo.
 */
export function isVideoReencodeSupported() {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") return false;
  const video = document.createElement("video");
  return typeof video.captureStream === "function" || typeof video.mozCaptureStream === "function";
}

function pickSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

/**
 * Phát lại đoạn [start, end] của 1 video nguồn (object URL) và ghi lại
 * bằng MediaRecorder — dùng để CẮT video (chỉ giữ đoạn [start, end]) và
 * NÉN video (nếu truyền `videoBitsPerSecond` thấp hơn bitrate gốc).
 *
 * @param {string} sourceUrl - object URL của video gốc (URL.createObjectURL)
 * @param {{start?: number, end?: number|null, videoBitsPerSecond?: number}} opts
 * @returns {Promise<File>} file video mới (định dạng trình duyệt hỗ trợ ghi, thường là .webm)
 */
export function reencodeVideoSegment(sourceUrl, { start = 0, end = null, videoBitsPerSecond } = {}) {
  return new Promise((resolve, reject) => {
    if (!isVideoReencodeSupported()) {
      reject(new Error("UNSUPPORTED"));
      return;
    }
    const mimeType = pickSupportedMimeType();
    if (!mimeType) {
      reject(new Error("UNSUPPORTED"));
      return;
    }

    const video = document.createElement("video");
    video.src = sourceUrl;
    video.muted = true; // Không phát tiếng ra loa lúc xử lý — track âm thanh vẫn được ghi qua captureStream.
    video.playsInline = true;

    let settled = false;
    const settle = (fn) => {
      if (settled) return;
      settled = true;
      video.pause();
      video.onended = null;
      video.ontimeupdate = null;
      video.onseeked = null;
      video.onerror = null;
      fn();
    };

    video.onerror = () => settle(() => reject(new Error("Không đọc được video, tệp có thể bị hỏng.")));

    video.onloadedmetadata = () => {
      const duration = video.duration || 0;
      const clampedEnd = end != null ? Math.min(end, duration) : duration;
      const clampedStart = Math.max(0, Math.min(start, Math.max(clampedEnd - 0.1, 0)));

      const startCaptureAndRecord = () => {
        const stream = getVideoCaptureStream(video);
        if (!stream) {
          settle(() => reject(new Error("UNSUPPORTED")));
          return;
        }

        const recorderOptions = { mimeType };
        if (videoBitsPerSecond) recorderOptions.videoBitsPerSecond = videoBitsPerSecond;

        let recorder;
        try {
          recorder = new MediaRecorder(stream, recorderOptions);
        } catch {
          settle(() => reject(new Error("UNSUPPORTED")));
          return;
        }

        const chunks = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        const stopRecorder = () => {
          if (recorder.state !== "inactive") recorder.stop();
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          if (blob.size === 0) {
            settle(() => reject(new Error("Không xử lý được video, vui lòng thử lại.")));
            return;
          }
          const ext = mimeType.includes("mp4") ? "mp4" : "webm";
          const file = new File([blob], `video-${Date.now()}.${ext}`, { type: mimeType });
          settle(() => resolve(file));
        };

        video.ontimeupdate = () => {
          if (video.currentTime >= clampedEnd - 0.05) stopRecorder();
        };
        video.onended = () => stopRecorder();

        recorder.start();
        video.play().catch(() => stopRecorder());
      };

      // Nếu đoạn cần cắt bắt đầu ngay từ giây 0 (trường hợp phổ biến khi chỉ
      // NÉN cả video, không cắt bớt), currentTime đã sẵn = 0 -> đặt lại
      // cùng giá trị có thể KHÔNG bắn sự kiện "seeked" (một số trình duyệt
      // coi đây không phải 1 lượt seek thật sự), khiến hàm treo vô thời hạn
      // nếu cứ chờ onseeked. Trường hợp này bỏ qua bước seek, chạy thẳng.
      if (clampedStart <= 0.05) {
        startCaptureAndRecord();
        return;
      }

      video.onseeked = () => {
        video.onseeked = null;
        startCaptureAndRecord();
      };

      try {
        video.currentTime = clampedStart;
      } catch {
        settle(() => reject(new Error("Không đọc được video để cắt/nén.")));
      }
    };

    video.load();
  });
}

/**
 * Tự động giảm dung lượng video bằng cách ghi lại với bitrate thấp dần cho
 * tới khi đạt dưới `maxBytes` (hoặc hết lượt thử — trả về bản nhẹ nhất đã
 * nén được). Dùng khi video đã đủ ngắn (không cần cắt) nhưng dung lượng
 * vượt giới hạn cho phép.
 *
 * @param {string} sourceUrl - object URL của video cần nén
 * @param {number} duration - thời lượng video (giây), dùng để tính bitrate mục tiêu
 * @param {number} maxBytes - dung lượng tối đa cho phép
 * @returns {Promise<File>}
 */
export async function autoCompressVideo(sourceUrl, duration, maxBytes) {
  // Bitrate mục tiêu = dung lượng cho phép / thời lượng, trừ hao 25% vì bộ
  // mã hoá của trình duyệt không khớp tuyệt đối với bitrate yêu cầu.
  let targetBitrate = Math.floor((maxBytes * 8 * 0.75) / Math.max(duration, 1));
  const MIN_BITRATE = 250_000; // ~250kbps — mức sàn, chất lượng thấp nhưng vẫn xem được.
  const MAX_ATTEMPTS = 2; // Mỗi lượt thử tốn thời gian ~ bằng đúng độ dài video, không thử quá nhiều lần.

  let lastFile = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // eslint-disable-next-line no-await-in-loop -- cần đợi từng lượt nén để kiểm tra lại dung lượng trước khi thử tiếp
    const file = await reencodeVideoSegment(sourceUrl, {
      start: 0,
      end: duration,
      videoBitsPerSecond: targetBitrate,
    });
    lastFile = file;
    if (file.size <= maxBytes) return file;
    targetBitrate = Math.max(MIN_BITRATE, Math.floor(targetBitrate * 0.55));
  }
  return lastFile; // Có thể vẫn hơi vượt giới hạn sau các lượt thử — vẫn trả về bản nhẹ nhất đã nén được.
}
