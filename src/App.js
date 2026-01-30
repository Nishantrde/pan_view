import './App.css';
import { useEffect, useRef, useState } from 'react';

const PAN_WIDTH = 4096;
const PAN_HEIGHT = 1024;
const SEGMENT_WIDTH = 112;
const CAPTURE_INTERVAL = 90;

function App() {
  const viewerRef = useRef(null);
  const videoRef = useRef(null);
  const panoramaRef = useRef(null);
  const streamRef = useRef(null);
  const orientationRef = useRef({ alpha: null });
  const startAlphaRef = useRef(null);
  const lastCaptureRef = useRef(0);
  const relativeAlphaRef = useRef(0);
  const capturingRef = useRef(false);
  const autoStartRef = useRef(true);
  const viewOffsetRef = useRef(0);
  const pointerRef = useRef({ isDown: false, startX: 0, startOffset: 0 });
  const telemetryLastRef = useRef(0);
  const sensorReadyRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const rafRef = useRef(null);

  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [sensorReady, setSensorReady] = useState(false);
  const [message, setMessage] = useState('Requesting camera & gyroscope permissions...');
  const [telemetry, setTelemetry] = useState({ coverage: 0, alpha: 0 });
  const [gyroAllowed, setGyroAllowed] = useState(true);

  useEffect(() => {
    capturingRef.current = capturing;
  }, [capturing]);

  useEffect(() => {
    if (cameraReady && sensorReady && !capturing && autoStartRef.current) {
      setCapturing(true);
      setMessage('Stitching in progress — keep sweeping slowly to cover every azimuth.');
    }
  }, [cameraReady, sensorReady, capturing]);

  useEffect(() => {
    const viewerCanvas = viewerRef.current;
    const videoElement = videoRef.current;
    if (!viewerCanvas || !videoElement) return;

    const panoCanvas = document.createElement('canvas');
    panoCanvas.width = PAN_WIDTH;
    panoCanvas.height = PAN_HEIGHT;
    const panoCtx = panoCanvas.getContext('2d');
    panoCtx.fillStyle = '#05070a';
    panoCtx.fillRect(0, 0, PAN_WIDTH, PAN_HEIGHT);
    panoramaRef.current = panoCanvas;

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = SEGMENT_WIDTH;
    frameCanvas.height = PAN_HEIGHT;
    const frameCtx = frameCanvas.getContext('2d');

    const viewerCtx = viewerCanvas.getContext('2d');

    const handleResize = () => {
      viewerCanvas.width = viewerCanvas.clientWidth;
      viewerCanvas.height = viewerCanvas.clientHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const updateTelemetry = (alphaValue, relativeAlpha) => {
      const now = performance.now();
      if (now - telemetryLastRef.current < 200) return;
      telemetryLastRef.current = now;
      setTelemetry({
        coverage: Number(Math.min(100, (relativeAlpha / 360) * 100).toFixed(1)),
        alpha: Number((alphaValue ?? 0).toFixed(1))
      });
    };

    const handleOrientation = (event) => {
      const alpha = typeof event.alpha === 'number' ? event.alpha : orientationRef.current.alpha;
      if (alpha == null) return;
      orientationRef.current.alpha = alpha;
      if (startAlphaRef.current == null) {
        startAlphaRef.current = alpha;
      }
      const relative = (alpha - startAlphaRef.current + 360) % 360;
      relativeAlphaRef.current = relative;
      if (!pointerRef.current.isDown) {
        viewOffsetRef.current = (relative / 360) * PAN_WIDTH;
      }
      if (!sensorReadyRef.current) {
        sensorReadyRef.current = true;
        setSensorReady(true);
        setMessage('Gyroscope ready. Sweep your phone to stitch a continuous 360-degree panorama.');
      }
      updateTelemetry(alpha, relative);
    };

    const startOrientation = async () => {
      if (typeof DeviceOrientationEvent === 'undefined') {
        setGyroAllowed(false);
        setMessage('Gyroscope not supported. Use a device with motion sensors for accurate stitching.');
        sensorReadyRef.current = true;
        setSensorReady(true);
        return;
      }
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission !== 'granted') {
            setGyroAllowed(false);
            setMessage('Gyroscope permission denied. Use touch to pan but capture will be limited.');
            sensorReadyRef.current = true;
            setSensorReady(true);
            return;
          }
        } catch (error) {
          setGyroAllowed(false);
          setMessage('Gyroscope permission prompt failed. Use touch to pan instead.');
          sensorReadyRef.current = true;
          setSensorReady(true);
          return;
        }
      }
      window.addEventListener('deviceorientation', handleOrientation, true);
    };

    const addFrameToPanorama = () => {
      if (!capturingRef.current) return;
      const now = performance.now();
      if (now - lastCaptureRef.current < CAPTURE_INTERVAL) return;
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;
      const alpha = orientationRef.current.alpha;
      if (!videoWidth || !videoHeight || alpha == null) return;
      lastCaptureRef.current = now;
      frameCtx.clearRect(0, 0, SEGMENT_WIDTH, PAN_HEIGHT);
      frameCtx.drawImage(videoElement, 0, 0, SEGMENT_WIDTH, PAN_HEIGHT);
      if (startAlphaRef.current == null) {
        startAlphaRef.current = alpha;
      }
      const relative = (alpha - startAlphaRef.current + 360) % 360;
      relativeAlphaRef.current = relative;
      const destX = Math.floor((relative / 360) * PAN_WIDTH);
      const firstWidth = Math.min(SEGMENT_WIDTH, PAN_WIDTH - destX);
      panoCtx.drawImage(frameCanvas, 0, 0, firstWidth, PAN_HEIGHT, destX, 0, firstWidth, PAN_HEIGHT);
      if (firstWidth < SEGMENT_WIDTH) {
        const remainder = SEGMENT_WIDTH - firstWidth;
        panoCtx.drawImage(frameCanvas, firstWidth, 0, remainder, PAN_HEIGHT, 0, 0, remainder, PAN_HEIGHT);
      }
      updateTelemetry(alpha, relative);
    };

    const drawViewer = () => {
      const width = viewerCanvas.width;
      const height = viewerCanvas.height;
      viewerCtx.clearRect(0, 0, width, height);
      const panorama = panoramaRef.current;
      if (!panorama) return;
      const offset = Math.floor(viewOffsetRef.current) % PAN_WIDTH;
      const firstSlice = Math.min(width, PAN_WIDTH - offset);
      viewerCtx.drawImage(panorama, offset, 0, firstSlice, PAN_HEIGHT, 0, 0, firstSlice, height);
      if (firstSlice < width) {
        viewerCtx.drawImage(panorama, 0, 0, width - firstSlice, PAN_HEIGHT, firstSlice, 0, width - firstSlice, height);
      }
    };

    const animate = () => {
      drawViewer();
      addFrameToPanorama();
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    const handlePointerDown = (event) => {
      pointerRef.current.isDown = true;
      pointerRef.current.startX = event.clientX;
      pointerRef.current.startOffset = viewOffsetRef.current;
      viewerCanvas.setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event) => {
      if (!pointerRef.current.isDown) return;
      const delta = event.clientX - pointerRef.current.startX;
      const ratio = viewerCanvas.width ? delta / viewerCanvas.width : 0;
      viewOffsetRef.current = (pointerRef.current.startOffset - ratio * PAN_WIDTH + PAN_WIDTH) % PAN_WIDTH;
    };
    const releasePointer = (event) => {
      pointerRef.current.isDown = false;
      if (event.pointerId !== undefined && viewerCanvas.hasPointerCapture(event.pointerId)) {
        viewerCanvas.releasePointerCapture(event.pointerId);
      }
    };
    viewerCanvas.addEventListener('pointerdown', handlePointerDown);
    viewerCanvas.addEventListener('pointermove', handlePointerMove);
    viewerCanvas.addEventListener('pointerup', releasePointer);
    viewerCanvas.addEventListener('pointerleave', releasePointer);
    viewerCanvas.addEventListener('pointercancel', releasePointer);

    const handleLoadedData = () => {
      if (!cameraReadyRef.current) {
        cameraReadyRef.current = true;
        setCameraReady(true);
        setMessage((prev) =>
          prev.includes('gyroscope')
            ? 'Gyroscope ready. Begin sweeping for the complete wrap-around.'
            : 'Camera ready — waiting for gyroscope data to start stitching.'
        );
      }
    };
    videoElement.addEventListener('loadeddata', handleLoadedData);

    const openCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage('Camera API not available in this browser.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        streamRef.current = stream;
        videoElement.srcObject = stream;
        await videoElement.play();
      } catch (error) {
        console.error(error);
        setMessage('Camera permission denied. Enable camera access to capture a panorama.');
      }
    };

    startOrientation();
    openCamera();

    return () => {
      window.removeEventListener('resize', handleResize);
      viewerCanvas.removeEventListener('pointerdown', handlePointerDown);
      viewerCanvas.removeEventListener('pointermove', handlePointerMove);
      viewerCanvas.removeEventListener('pointerup', releasePointer);
      viewerCanvas.removeEventListener('pointerleave', releasePointer);
      viewerCanvas.removeEventListener('pointercancel', releasePointer);
      videoElement.removeEventListener('loadeddata', handleLoadedData);
      window.removeEventListener('deviceorientation', handleOrientation, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const toggleCapture = () => {
    autoStartRef.current = false;
    const next = !capturingRef.current;
    capturingRef.current = next;
    setCapturing(next);
    setMessage(next ? 'Resuming stitching as you sweep the space.' : 'Stitching paused. You can still pan the panorama with touch.');
  };

  const resetPanorama = () => {
    const panorama = panoramaRef.current;
    if (!panorama) return;
    const ctx = panorama.getContext('2d');
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, PAN_WIDTH, PAN_HEIGHT);
    startAlphaRef.current = null;
    relativeAlphaRef.current = 0;
    viewOffsetRef.current = 0;
    lastCaptureRef.current = 0;
    telemetryLastRef.current = 0;
    setTelemetry({ coverage: 0, alpha: 0 });
    setMessage('Panorama cleared. Begin sweeping again to rebuild the full 360-degree view.');
  };

  const gyroStateText = gyroAllowed ? 'Gyroscope available' : 'Gyroscope blocked';
  return (
    <div className="App-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Realtime Gyro Stitching</p>
          <h1>360-degree Panorama Capture</h1>
          <p>
            Sweep your phone slowly while the camera and gyroscope stream frames into the panorama canvas.
            The stitching happens live so you see the growing wrap-around immediately.
          </p>
        </div>
      </header>
      <div className="viewer-shell">
        <canvas ref={viewerRef} className="viewer-canvas" />
        <video ref={videoRef} className="camera-preview" autoPlay muted playsInline />
        <div className="status-panel">
          <div className="status-row">
            <span>Status</span>
            <strong>{capturing ? 'Capturing' : 'Idle'}</strong>
          </div>
          <div className="status-row">
            <span>Coverage</span>
            <strong>{telemetry.coverage.toFixed(1)}%</strong>
          </div>
          <div className="status-row">
            <span>Orientation</span>
            <strong>{telemetry.alpha.toFixed(1)}deg</strong>
          </div>
          <p className="status-message">{message}</p>
          <p className="status-foot">{gyroStateText}</p>
        </div>
      </div>
      <footer className="control-bar">
        <button onClick={toggleCapture}>{capturing ? 'Pause Stitching' : 'Resume Stitching'}</button>
        <button onClick={resetPanorama} className="ghost">
          Reset Panorama
        </button>
      </footer>
    </div>
  );
}

export default App;
