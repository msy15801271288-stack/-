import { FilesetResolver, HandLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { GestureType, GestureResult } from "../types";

let handLandmarker: HandLandmarker | undefined;
let runningMode: "IMAGE" | "VIDEO" = "VIDEO";

export const initializeHandLandmarker = async () => {
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: runningMode,
      numHands: 1
    });
    return true;
  } catch (error) {
    console.error("Error initializing HandLandmarker:", error);
    return false;
  }
};

export const detectGesture = (video: HTMLVideoElement): GestureResult => {
  if (!handLandmarker) return { gesture: GestureType.NONE, cursor: null };

  const startTimeMs = performance.now();
  const results = handLandmarker.detectForVideo(video, startTimeMs);

  if (results.landmarks && results.landmarks.length > 0) {
    const landmarks = results.landmarks[0];
    
    // Key landmarks
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const wrist = landmarks[0];

    // Calculate distances to determine open/closed
    const tips = [indexTip, middleTip, ringTip, pinkyTip];
    const avgTipDistToWrist = tips.reduce((acc, tip) => {
      const d = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
      return acc + d;
    }, 0) / 4;

    const thumbIndexDist = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + 
      Math.pow(thumbTip.y - indexTip.y, 2)
    );

    // Cursor position (inverted X because webcam is mirrored usually, but we handle mirror in CSS. 
    // MediaPipe output x is 0-1. 0 is left. If we mirror CSS, we use x as is.)
    const cursor = { x: indexTip.x, y: indexTip.y };

    // 1. PINCH (Click equivalent)
    if (thumbIndexDist < 0.05) {
      return { gesture: GestureType.PINCH, cursor };
    }

    // 2. CLOSED FIST (Reset)
    // If fingers are curled, tip distance to wrist is small compared to palm size
    // Simplified: Check if tips are below a certain y threshold relative to knuckles, or just close to wrist.
    // Heuristic: If average tip distance is small.
    if (avgTipDistToWrist < 0.25) { // Threshold depends on camera distance, but 0.2-0.3 is typical for fist
       return { gesture: GestureType.CLOSED_FIST, cursor };
    }

    // 3. OPEN PALM (Explode)
    // If fingers are extended
    if (avgTipDistToWrist > 0.4) {
       return { gesture: GestureType.OPEN_PALM, cursor };
    }

    // Default: Pointing/Hover
    return { gesture: GestureType.POINTING, cursor };
  }

  return { gesture: GestureType.NONE, cursor: null };
};