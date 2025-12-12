import React, { useState, useEffect, useRef } from 'react';
import ChristmasTree from './components/ChristmasTree';
import { initializeHandLandmarker, detectGesture } from './services/gestureService';
import { GestureType, GestureResult } from './types';
import { Camera, ImagePlus, Loader2, Maximize2, Minimize2, Volume2, VolumeX, Trash2 } from 'lucide-react';

// Optimized Jingle Bells sources (Mixkit is usually faster/more reliable globally)
const JINGLE_BELLS_URLS = [
  "https://assets.mixkit.co/music/preview/mixkit-christmas-jingle-bells-2963.mp3", 
  "https://upload.wikimedia.org/wikipedia/commons/e/e6/Jingle_Bells_%28Kevin_MacLeod%29_%28ISRC_USUAN1100187%29.mp3"
];

const App: React.FC = () => {
  const [isExploded, setIsExploded] = useState(false);
  const [photos, setPhotos] = useState<HTMLImageElement[]>([]);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [gestureState, setGestureState] = useState<GestureResult>({ gesture: GestureType.NONE, cursor: null });
  
  // Music states
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isMusicLoading, setIsMusicLoading] = useState(false);
  const [musicSourceIndex, setMusicSourceIndex] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Initialize volume - set to 0.8 to ensure it is audible
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.volume = 0.8;
    }
  }, []);

  const toggleMusic = async () => {
      if (!audioRef.current) return;

      if (isMusicPlaying) {
          audioRef.current.pause();
      } else {
          setIsMusicLoading(true);
          try {
              // Ensure we are ready to play
              if (audioRef.current.readyState === 0) {
                 audioRef.current.load();
              }
              await audioRef.current.play();
          } catch (e) {
              console.error("Play failed", e);
              setIsMusicLoading(false);
              handleAudioError();
          }
      }
  };

  const handleAudioError = () => {
      console.warn(`Audio source ${musicSourceIndex} failed.`);
      if (musicSourceIndex < JINGLE_BELLS_URLS.length - 1) {
          // Try next source
          const nextIndex = musicSourceIndex + 1;
          setMusicSourceIndex(nextIndex);
          // Wait briefly for React to update the src, then try playing again
          setTimeout(() => {
              if (audioRef.current) {
                  audioRef.current.play().catch(e => {
                      console.error("Backup source play failed", e);
                      setIsMusicLoading(false);
                      setIsMusicPlaying(false);
                  });
              }
          }, 300);
      } else {
          setIsMusicLoading(false);
          setIsMusicPlaying(false);
          if (confirm("在线音乐播放失败（可能是网络问题）。是否选择本地音乐文件播放？\nMusic failed to load. Play a local file instead?")) {
              musicInputRef.current?.click();
          }
      }
  };

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && audioRef.current) {
          const url = URL.createObjectURL(file);
          audioRef.current.src = url;
          audioRef.current.load();
          audioRef.current.play()
            .then(() => setIsMusicPlaying(true))
            .catch(e => console.error("Local play failed", e));
      }
  };

  // Initialize Camera & MediaPipe
  const startCamera = async () => {
    setIsLoadingCamera(true);
    try {
      const success = await initializeHandLandmarker();
      if (!success) {
        alert("Failed to load gesture recognition model.");
        setIsLoadingCamera(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener('loadeddata', () => {
          setCameraActive(true);
          setIsLoadingCamera(false);
          startDetectionLoop();
        });
      }
    } catch (err) {
      console.error(err);
      alert("Could not access camera. Please allow permissions.");
      setIsLoadingCamera(false);
    }
  };

  const startDetectionLoop = () => {
    const loop = () => {
      if (videoRef.current && videoRef.current.videoWidth > 0) {
        const result = detectGesture(videoRef.current);
        setGestureState(result);
      }
      requestAnimationFrame(loop);
    };
    loop();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos: HTMLImageElement[] = [];
      Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const img = new Image();
          img.src = evt.target?.result as string;
          img.onload = () => {
            setPhotos(prev => [...prev, img]);
          };
        };
        reader.readAsDataURL(file as Blob);
      });
    }
  };

  return (
    <div className="w-full h-screen relative bg-slate-900 text-white overflow-hidden font-sans selection:bg-rose-500 selection:text-white">
      {/* Hidden Video for MediaPipe */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden pointer-events-none" />
      
      {/* Audio Element */}
      <audio 
          ref={audioRef} 
          src={JINGLE_BELLS_URLS[musicSourceIndex]}
          loop 
          playsInline
          preload="auto"
          onPlay={() => {
              setIsMusicPlaying(true);
              setIsMusicLoading(false);
          }}
          onPause={() => setIsMusicPlaying(false)}
          onWaiting={() => setIsMusicLoading(true)}
          onPlaying={() => setIsMusicLoading(false)}
          onError={handleAudioError}
      />
      <input 
         type="file" 
         accept="audio/*" 
         className="hidden" 
         ref={musicInputRef} 
         onChange={handleMusicUpload} 
      />

      {/* Main 3D Scene */}
      <div className="absolute inset-0 z-0">
        <ChristmasTree 
           isExploded={isExploded} 
           onToggleExplode={setIsExploded} 
           photos={photos}
           gestureCursor={gestureState.cursor}
           currentGesture={gestureState.gesture}
        />
      </div>

      {/* Greeting Overlay */}
      <div 
         className={`absolute inset-0 flex items-center justify-center z-5 pointer-events-none transition-all duration-1000 ${isExploded ? 'opacity-0 scale-150 blur-sm' : 'opacity-100 scale-100'}`}
      >
         <div className="text-center transform translate-y-64 sm:translate-y-80">
            <h1 className="text-6xl md:text-8xl font-bold font-christmas text-yellow-300 drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)] animate-pulse">
               Merry Christmas
            </h1>
         </div>
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6">
        
        {/* Header */}
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="bg-slate-800/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-xl">
             <h1 className="text-3xl font-bold font-christmas text-rose-500 mb-1 drop-shadow-sm">Interactive Tree</h1>
             <p className="text-slate-300 text-sm max-w-xs font-light">
                Left click to Reveal. Right click to Restore. <br/>
                <span className="text-xs opacity-75">Upload photos to customize!</span>
             </p>
          </div>

          <div className="flex gap-3">
             <button 
                 onClick={toggleMusic}
                 disabled={isMusicLoading}
                 className={`flex items-center gap-2 text-white p-3 rounded-full transition-all shadow-lg active:scale-95 ${
                    isMusicPlaying ? 'bg-emerald-600 shadow-emerald-600/50' : 'bg-slate-700 hover:bg-slate-600'
                 }`}
                 title={isMusicPlaying ? "Pause Music" : "Play Jingle Bells"}
             >
                 {isMusicLoading ? (
                     <Loader2 size={24} className="animate-spin text-white" />
                 ) : isMusicPlaying ? (
                     <Volume2 size={24} />
                 ) : (
                     <VolumeX size={24} />
                 )}
             </button>

             {photos.length > 0 && (
                <button 
                  onClick={() => setPhotos([])}
                  className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-full transition-all shadow-lg active:scale-95"
                >
                  <Trash2 size={18} />
                  <span className="text-sm font-semibold">Clear</span>
                </button>
             )}

             <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full transition-all shadow-lg active:scale-95"
             >
                <ImagePlus size={18} />
                <span className="text-sm font-bold">Add Photos</span>
             </button>
             <input 
               type="file" 
               multiple 
               accept="image/*" 
               className="hidden" 
               ref={fileInputRef} 
               onChange={handleFileUpload} 
             />
          </div>
        </div>

        {/* Gesture Controls Status */}
        <div className="pointer-events-auto self-end flex flex-col items-end gap-4">
           {cameraActive ? (
             <div className="bg-slate-800/90 backdrop-blur-md p-4 rounded-xl border border-emerald-500/30 shadow-2xl w-64">
                <div className="flex items-center gap-2 mb-3 text-emerald-400 font-semibold border-b border-emerald-500/20 pb-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   Gesture Control
                </div>
                <div className="space-y-2 text-xs text-slate-300">
                   <div className={`flex items-center gap-2 ${gestureState.gesture === GestureType.OPEN_PALM ? 'text-white font-bold' : ''}`}>
                      <Maximize2 size={14} /> Open Hand: Scatter
                   </div>
                   <div className={`flex items-center gap-2 ${gestureState.gesture === GestureType.CLOSED_FIST ? 'text-white font-bold' : ''}`}>
                      <Minimize2 size={14} /> Closed Fist: Restore
                   </div>
                   <div className={`flex items-center gap-2 ${gestureState.gesture === GestureType.PINCH ? 'text-white font-bold' : ''}`}>
                      <span className="w-3.5 h-3.5 border-2 border-current rounded-full"></span> Pinch: Zoom Photo
                   </div>
                </div>
             </div>
           ) : (
             <button 
               onClick={startCamera}
               disabled={isLoadingCamera}
               className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 px-5 py-3 rounded-2xl transition-all shadow-lg active:scale-95"
             >
                {isLoadingCamera ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                <span className="font-medium">Enable Magic Gestures</span>
             </button>
           )}
        </div>
        
        {/* Footer/Hint */}
        <div className="pointer-events-none text-center opacity-40">
           <p className="text-[10px] text-slate-400 tracking-widest uppercase">Interactive Christmas Tree</p>
        </div>
      </div>
    </div>
  );
};

export default App;