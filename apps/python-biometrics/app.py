import base64
import cv2
import numpy as np
import mediapipe as mp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="SCADA Python Biometrics Service")

# Allow CORS for direct communication if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=True,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5
)

# 42 select landmark indices covering key facial features (eyes, eyebrows, nose, mouth, jawline)
LANDMARK_INDICES = [
    4, 1, 197, 2, 98, 327,                          # Nose structure
    33, 133, 159, 145,                              # Left eye
    263, 362, 386, 374,                             # Right eye
    70, 107, 300, 336,                              # Eyebrows
    61, 291, 0, 17, 13, 14,                         # Lips contour
    10, 152, 234, 454, 58, 288, 172, 397,           # Face borders & jaw
    136, 365, 149, 378, 150, 379, 109, 338, 54, 284 # General cheek / face contour
]

class ImagePayload(BaseModel):
    image: str

@app.post("/extract")
async def extract_descriptor(payload: ImagePayload):
    try:
        # Decode base64 image
        header, encoded = payload.image.split(",", 1) if "," in payload.image else ("", payload.image)
        image_bytes = base64.b64decode(encoded)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            return {"success": False, "message": "Failed to decode image"}

        h, w, _ = img.shape
        print(f"Debug: Received image of size {w}x{h}")
        cv2.imwrite("debug_face.jpg", img)
        
        # Convert BGR to RGB
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Process face mesh
        results = face_mesh.process(img_rgb)
        
        if not results.multi_face_landmarks:
            return {"success": False, "message": "Wajah tidak terdeteksi. Silakan posisikan wajah di tengah kamera."}
        
        face_landmarks = results.multi_face_landmarks[0]
        
        # 1. Normalization: Origin at Nose Tip (landmark 4)
        nose = face_landmarks.landmark[4]
        
        coords = []
        for lm in face_landmarks.landmark:
            # Shift nose tip to (0, 0, 0)
            coords.append([lm.x - nose.x, lm.y - nose.y, lm.z - nose.z])
            
        # 2. Scale Invariance: Distance between left cheek (234) and right cheek (454)
        lc = coords[234]
        rc = coords[454]
        face_width = np.sqrt((lc[0] - rc[0])**2 + (lc[1] - rc[1])**2 + (lc[2] - rc[2])**2)
        if face_width == 0:
            face_width = 1.0
            
        # Scale coordinates
        normalized_coords = []
        for c in coords:
            normalized_coords.append([c[0] / face_width, c[1] / face_width, c[2] / face_width])
            
        # 3. Extract the 42 specific indices to form 126 float values
        descriptor = []
        for idx in LANDMARK_INDICES:
            descriptor.extend(normalized_coords[idx])
            
        # Pad with 2 zeros to make it exactly 128 elements for the DB schema
        descriptor.extend([0.0, 0.0])
        
        return {"success": True, "descriptor": descriptor}
        
    except Exception as e:
        return {"success": False, "message": f"Server processing error: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
