import './App.css';
import { useEffect, useRef } from 'react';
import create360Viewer from '../index.js';

function App() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create a canvas element for the viewer
    const canvas = document.createElement('canvas');
    containerRef.current.appendChild(canvas);

    // Initialize the 360 viewer with an image URL
    // Replace with your actual panorama image URL
    const viewer = create360Viewer({
      canvas: canvas,
      image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=2000&h=1000'
    });

    // Handle window resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      viewer.destroy();
    };
  }, []);

  return (
    <div className="App" ref={containerRef} style={{ width: '100%', height: '100vh' }}>
    </div>
  );
}

export default App;
