# YBot Web Test Area (Static Version)

A completely static web-based 3D test environment featuring the YBot character model with interactive camera controls.

## Features

- **Full Body IK System**: Inverse Kinematics for arms, legs, spine, and head
- **LLM Pose Control**: Text input to control YBot poses (wave, point, dance, relax)
- **3D YBot Character**: Interactive rigged character model
- **Real-time Animation**: Smooth IK solving and pose transitions
- **Pose Presets**: Pre-defined poses for testing
- **Visual Feedback**: Semi-transparent target spheres show IK goals
- **Completely Static**: No server required - works with any static file host

## Project Structure

```
IKROBOTLLMTEST/
├── index.html        # Main HTML page with Three.js scene
├── assets/
│   └── YBot.fbx      # 3D character model
└── README.md         # This file
```

## How to Run

Simply run the launcher script:

```bash
python launch.py
```

This will:
- ✅ Check for required files
- ✅ Start a local web server
- ✅ Automatically open your browser
- ✅ Serve the YBot 3D application

## Controls

- **Left-click + drag**: Orbit camera around YBot
- **Mouse wheel**: Zoom in/out
- **Right-click**: Browser context menu

### IK & Pose Controls

- **Pose Presets**: Wave Hello, Point, Dance, Relax buttons
- **LLM Input**: Type pose descriptions like "wave", "point", "dance", or "relax"
- **Visual Targets**: Colored spheres briefly appear to show IK goals

### Technical Features

- **Full Body IK**: Arms, legs, spine, and head chains
- **LLM Integration**: Text-to-pose conversion
- **Real-time Solving**: WASM-accelerated IK calculations
- **Bone Detection**: Automatic rig analysis and chain creation

## Technical Details

- **3D Engine**: Three.js with FBX support
- **Model Format**: FBX (Autodesk FBX) with fflate decompression
- **Controls**: OrbitControls from Three.js examples
- **Lighting**: Ambient + Directional with shadow mapping
- **Dependencies**: Three.js, fflate (for FBX decompression)

## Browser Compatibility

Works in modern browsers that support WebGL:
- Chrome 51+
- Firefox 45+
- Safari 10+
- Edge 79+

## Troubleshooting

If the YBot model doesn't load:
- Check that YBot.fbx is in the `static/` directory
- Check browser console for loading errors
- A green capsule placeholder will appear if loading fails
- Make sure you're opening via a web server (not file:// protocol)

## Development

Edit `index.html` directly. All JavaScript and CSS are embedded for simplicity. The project is completely self-contained with no external dependencies except the CDN-hosted Three.js libraries.