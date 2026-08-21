import { useState, useRef, useEffect } from "react";
import {
  Camera,
  Upload,
  Trash2,
  RotateCw,
  X,
  Check,
  User,
  Loader2,
  RefreshCw,
} from "lucide-react";
import api from "../../lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";

export default function PhotoUploadInput({
  value,
  onChange,
  label = "Photo",
  name = "?",
  size = "lg", // "sm" | "md" | "lg" | "xl"
  category = "PROFILE_PHOTO",
  hint = "JPG, PNG, WebP up to 5MB",
  allowCamera = true,
  shape = "circle", // "circle" | "rounded"
  className = "",
}) {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState("user"); // "user" | "environment"
  const [capturedBlobUrl, setCapturedBlobUrl] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);

  // Size definitions
  const sizeMap = {
    sm: { box: "h-16 w-16", text: "text-xs", avatar: "text-base" },
    md: { box: "h-20 w-20", text: "text-xs", avatar: "text-lg" },
    lg: { box: "h-24 w-24", text: "text-sm", avatar: "text-2xl" },
    xl: { box: "h-32 w-32", text: "text-sm", avatar: "text-3xl" },
  };
  const curSize = sizeMap[size] || sizeMap.lg;

  // Cleanup camera stream on close or unmount
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Upload file helper
  const uploadImageFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG, JPG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      const res = await api.post("/files/upload", formData);
      const uploadedUrl = res.data?.data?.url || res.data?.url;
      if (uploadedUrl) {
        onChange(uploadedUrl);
        toast.success("Photo uploaded successfully");
      } else {
        throw new Error("No URL returned");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload photo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImageFile(file);
    }
  };

  const handleRemovePhoto = () => {
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ── Camera capture methods ────────────────────────────────────────────────
  const startCamera = async (facing = facingMode) => {
    setCameraLoading(true);
    setCameraError(null);
    setCapturedBlobUrl(null);
    setCapturedBlob(null);
    stopCameraStream();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported on this device/browser");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Camera permission was denied. Please allow camera access in your browser."
          : err.message || "Unable to access camera"
      );
    } finally {
      setCameraLoading(false);
    }
  };

  const openCameraModal = () => {
    setCameraOpen(true);
    setTimeout(() => {
      startCamera(facingMode);
    }, 100);
  };

  const closeCameraModal = () => {
    stopCameraStream();
    setCameraOpen(false);
    setCapturedBlobUrl(null);
    setCapturedBlob(null);
  };

  const toggleFacingMode = () => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");

    // Mirror horizontal if front camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const blobUrl = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setCapturedBlobUrl(blobUrl);
      },
      "image/jpeg",
      0.9
    );
  };

  const confirmCapturedPhoto = async () => {
    if (!capturedBlob) return;
    const file = new File(
      [capturedBlob],
      `photo-capture-${Date.now()}.jpg`,
      { type: "image/jpeg" }
    );
    closeCameraModal();
    await uploadImageFile(file);
  };

  const initials = name
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("") || "?";

  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="block text-xs font-semibold text-gray-700">
          {label}
        </label>
      )}

      <div className="flex items-center gap-4">
        {/* Photo Box Preview */}
        <div className="relative group shrink-0">
          <div
            className={clsx(
              curSize.box,
              shape === "circle" ? "rounded-full" : "rounded-2xl",
              "border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden transition-all shadow-2xs group-hover:border-primary-400",
              value ? "border-solid border-primary-500" : ""
            )}
          >
            {uploading ? (
              <div className="flex flex-col items-center justify-center p-2 text-primary-600">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-[10px] font-bold mt-1">Uploading</span>
              </div>
            ) : value ? (
              <img
                src={value}
                alt={label}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : initials && initials !== "?" ? (
              <span
                className={clsx(
                  "font-bold text-gray-500 select-none",
                  curSize.avatar
                )}
              >
                {initials}
              </span>
            ) : (
              <User className="h-8 w-8 text-gray-400" />
            )}
          </div>

          {/* Quick Overlay Action Icon */}
          {value && !uploading && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              title="Remove photo"
              className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow-xs hover:bg-red-700 transition-transform active:scale-95 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Buttons & Instructions */}
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary btn-sm text-xs inline-flex items-center gap-1.5 font-semibold cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-primary-600" />
              {value ? "Change Photo" : "Upload Photo"}
            </button>

            {/* Live Camera Button */}
            {allowCamera && (
              <button
                type="button"
                onClick={openCameraModal}
                disabled={uploading}
                className="btn-secondary btn-sm text-xs inline-flex items-center gap-1.5 font-semibold text-gray-700 hover:text-primary-700 cursor-pointer"
                title="Take picture with webcam/camera"
              >
                <Camera className="h-3.5 w-3.5 text-emerald-600" />
                Take Picture
              </button>
            )}

            {/* Clear Button */}
            {value && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 transition-colors cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>

          {hint && <p className="text-[11px] text-gray-400 leading-tight">{hint}</p>}
        </div>
      </div>

      {/* ── Live Camera Modal ──────────────────────────────────────────────── */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl animate-scale-in dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <Camera className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">
                    Take {label || "Photo"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Align face in the frame and click capture
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCameraModal}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Camera Viewport / Preview */}
            <div className="relative bg-black flex items-center justify-center min-h-[300px] max-h-[420px] overflow-hidden">
              {cameraLoading && (
                <div className="flex flex-col items-center justify-center text-white py-16 gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                  <span className="text-sm font-medium">Starting camera…</span>
                </div>
              )}

              {cameraError && !cameraLoading && (
                <div className="p-6 text-center text-rose-300 max-w-sm space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
                    <Camera className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="btn-primary btn-sm text-xs cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Video Stream */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={clsx(
                  "w-full h-full object-contain max-h-[380px]",
                  facingMode === "user" ? "-scale-x-100" : "",
                  capturedBlobUrl || cameraError || cameraLoading ? "hidden" : "block"
                )}
              />

              {/* Hidden Canvas for capture rendering */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Oval Alignment Guide (Shown during live video) */}
              {!capturedBlobUrl && !cameraError && !cameraLoading && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-60 rounded-[50%] border-2 border-dashed border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
              )}

              {/* Captured Photo Review */}
              {capturedBlobUrl && (
                <img
                  src={capturedBlobUrl}
                  alt="Captured"
                  className="w-full h-full object-contain max-h-[380px]"
                />
              )}
            </div>

            {/* Footer Controls */}
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-800/60">
              <div>
                {!capturedBlobUrl && !cameraError && (
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-300 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Switch Camera
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {capturedBlobUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedBlobUrl(null);
                        setCapturedBlob(null);
                        startCamera(facingMode);
                      }}
                      className="btn-secondary btn-sm text-xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="h-3.5 w-3.5" /> Retake
                    </button>
                    <button
                      type="button"
                      onClick={confirmCapturedPhoto}
                      className="btn-primary btn-sm text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="h-4 w-4" /> Use Photo
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={closeCameraModal}
                      className="btn-secondary btn-sm text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={takeSnapshot}
                      disabled={cameraLoading || !!cameraError}
                      className="btn-primary btn-sm text-xs inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Camera className="h-4 w-4" /> Capture Photo
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
