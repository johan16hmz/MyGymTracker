import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { foodCameraErrorMessage, foodCodeFromScan, requestFoodCamera } from '../nutritionScan';

export function NutritionScanner({ onCode, onError }: { onCode: (code: string) => void; onError: (message: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbackRef = useRef({ onCode, onError });
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [ready, setReady] = useState(false);
  const controlsRef = useRef<IScannerControls | undefined>(undefined);
  callbackRef.current = { onCode, onError };
  useEffect(() => {
    let stopped = false;
    let nativeTimer: ReturnType<typeof setInterval> | undefined;
    let stream: MediaStream | undefined;
    let lastUnusableValue = '';
    const hints = new Map<DecodeHintType, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]],
    ]);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 300, delayBetweenScanSuccess: 350 });
    const video = videoRef.current;
    if (!video) return;

    const stopCapture = () => {
      if (nativeTimer) clearInterval(nativeTimer);
      controlsRef.current?.stop();
      controlsRef.current = undefined;
      stream?.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    };
    const fail = (message: string) => {
      if (stopped) return;
      stopped = true;
      stopCapture();
      callbackRef.current.onError(t(message));
    };

    const handleValue = (raw: string) => {
      if (stopped) return;
      const code = foodCodeFromScan(raw);
      if (!code) {
        if (raw !== lastUnusableValue) {
          lastUnusableValue = raw;
          setScanMessage(t('QR lu, mais aucun code produit reconnu. Essaie le code-barres EAN sur l’emballage.'));
        }
        return;
      }
      stopped = true;
      stopCapture();
      callbackRef.current.onCode(code);
    };

    const onResult = (result: { getText(): string } | undefined) => {
      if (result) handleValue(result.getText());
    };

    const start = async () => {
      if (!window.isSecureContext) {
        fail('La caméra nécessite HTTPS ou localhost. Ouvre l’application depuis une adresse sécurisée.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        fail('Ce navigateur ne permet pas l’accès à la caméra. Essaie Safari ou Chrome.');
        return;
      }
      try {
        stream = await requestFoodCamera(navigator.mediaDevices);
        if (stopped) { stream.getTracks().forEach(track => track.stop()); return; }
        const controls = await reader.decodeFromStream(stream, video, onResult);
        if (stopped) { controls.stop(); return; }
        controlsRef.current = controls;
      } catch (error) {
        fail(foodCameraErrorMessage(error));
        return;
      }

      setReady(true);
      setTorchAvailable(Boolean(controlsRef.current?.switchTorch));

      // Browser-native decoding is especially helpful for QR codes on supported phones.
      type NativeDetector = { detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>> };
      type NativeDetectorClass = {
        new(options: { formats: string[] }): NativeDetector;
        getSupportedFormats(): Promise<string[]>;
      };
      const Detector = (window as Window & { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
      if (!Detector) return;
      try {
        const supported = await Detector.getSupportedFormats();
        if (stopped) return;
        const formats = ['qr_code', 'data_matrix', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'].filter(format => supported.includes(format));
        if (!formats.length) return;
        const detector = new Detector({ formats });
        let detecting = false;
        nativeTimer = setInterval(() => {
          if (stopped || detecting || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          detecting = true;
          void detector.detect(video).then(results => {
            for (const result of results) { handleValue(result.rawValue); if (stopped) break; }
          }).catch(() => { /* ZXing continues scanning if native detection fails. */ }).finally(() => { detecting = false; });
        }, 350);
      } catch { /* Native API is optional; ZXing remains active. */ }
    };

    void start();
    return () => {
      stopped = true;
      stopCapture();
    };
  }, []);
  return <div className="nutrition-scanner"><div className="nutrition-scanner-preview"><video ref={videoRef} autoPlay muted playsInline aria-label={t('Aperçu de la caméra')} />{ready ? <><div className="nutrition-scan-frame" aria-hidden="true"/><span>{t('Place le QR ou le code-barres dans le cadre')}</span></> : <div className="nutrition-camera-starting" role="status"><span className="loading-spinner"/>{t('En attente de l’autorisation caméra…')}</div>}</div>{torchAvailable && <button type="button" className="btn btn-secondary nutrition-torch" onClick={() => {
    const next = !torchOn;
    void controlsRef.current?.switchTorch?.(next).then(() => setTorchOn(next)).catch(() => setScanMessage(t('Lampe indisponible sur cet appareil.')));
  }}>{torchOn ? t('Éteindre la lampe') : t('Allumer la lampe')}</button>}{scanMessage && <p className="nutrition-scan-message" role="status">{scanMessage}</p>}</div>;
}
