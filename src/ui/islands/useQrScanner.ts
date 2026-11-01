import { useEffect, useRef, useState } from 'react';
import { decodeQrFromImage } from '../../shared/qr/qrdecode';

export type ScannerProblem = 'denied' | 'unsupported' | 'insecure' | 'nocamera' | null;

/**
 * Opens the rear camera and reads QR codes from the video.
 * Uses the browser's BarcodeDetector when it exists (Chrome on Android) and Perkora's own
 * decoder otherwise (iPhone Safari, Firefox, desktop browsers), so it works everywhere a
 * camera is available over https.
 */
export function useQrScanner(onCode: (raw: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<ScannerProblem>(null);
  const [ready, setReady] = useState(false);
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: number | undefined;
    const start = async () => {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setProblem('insecure');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem('unsupported');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setProblem(name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nocamera' : name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unsupported');
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play().catch(() => undefined);
      setReady(true);

      let native: { detect: (src: CanvasImageSource) => Promise<{ rawValue?: string }[]> } | null = null;
      const BD = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
      if (BD) {
        try {
          const formats: string[] = (await BD.getSupportedFormats?.()) ?? ['qr_code'];
          if (formats.includes('qr_code')) native = new BD({ formats: ['qr_code'] });
        } catch {
          native = null;
        }
      }
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      let frame = 0;
      const tick = async () => {
        if (stopped) return;
        if (ctx && video.readyState >= 2 && video.videoWidth) {
          frame++;
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const scale = Math.min(1, 960 / Math.max(vw, vh));
          const w = Math.round(vw * scale);
          const h = Math.round(vh * scale);
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          let raw: string | null = null;
          if (native) {
            try {
              raw = (await native.detect(canvas))?.[0]?.rawValue ?? null;
            } catch {
              native = null;
            }
          }
          if (!raw) {
            try {
              raw = decodeQrFromImage(ctx.getImageData(0, 0, w, h), { tryInverted: frame % 5 === 4 });
            } catch {
              raw = null;
            }
          }
          if (raw && !stopped) {
            stopped = true;
            if (navigator.vibrate) navigator.vibrate(60);
            stream?.getTracks().forEach((t) => t.stop());
            cb.current(raw);
            return;
          }
        }
        timer = window.setTimeout(tick, 90);
      };
      tick();
    };
    start();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, problem, ready };
}
