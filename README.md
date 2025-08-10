## test-task

A small Expo React Native app backed by Firebase. The app signs in anonymously and calls a Firebase Cloud Function that generates a short demo video with an overlaid title, uploads it to Firebase Storage, and returns a direct download URL.

### Tech choices
- **Mobile**: Expo React Native (React Native 0.79, React 19, Expo SDK 53)
- **Backend**: Firebase Cloud Functions (Node.js 20, TypeScript)
- **Infra**: Firebase Storage for file outputs

### Folder structure (high signal only)

```
test-task/
  firebase.json               # Firebase config (build hooks, rules)
  storage.rules               # Firebase Storage security rules
  src/
    firebaseClient.ts         # App-side Firebase init + callable function client
  functions/                  # Backend (Firebase Cloud Functions)
    package.json              # Node 20 runtime, build/serve/deploy scripts
    tsconfig.json             # TS build outDir lib/, rootDir src/
    src/
      index.ts                # Backend entry: define callable functions here
      assets/
        font.ttf              # Font used by FFmpeg drawtext filter (packaged at build)
    lib/                      # Built JS output (generated)
    assets/                   # Built assets copied from src/assets (generated)
```

### Backend details (functions/)
- **Location**: `functions/`
- **Runtime**: Node.js `20` with TypeScript (compiled to `functions/lib`)
- **Callable function**: `generateLifeDemo`
  - **Auth**: requires a signed-in user (the app uses anonymous auth)
  - **What it does**:
    1. Downloads a small stock video clip
    2. Uses FFmpeg to create a 10s 1080x1920 vertical video, overlays centered text "Life Demo" (yellow) using a local TTF font
    3. Uploads the result to Firebase Storage bucket `test-task-rn.firebasestorage.app` under `renders/`
    4. Returns a public download URL and metadata `{ url, objectName, bucket }`
  - **FFmpeg binaries**: provided via `@ffmpeg-installer/ffmpeg` and `@ffprobe-installer/ffprobe`, used through `fluent-ffmpeg`
  - **Font source**: prefers packaged `functions/src/assets/font.ttf`; alternatively can use env var `FONT_FILE` pointing to a readable `.ttf`
  - **Resource config**: runs with `memory: 1GB`, `timeout: 540s` (see `functions/src/index.ts`)

### How the app calls the backend
- File: `src/firebaseClient.ts`
  - Initializes Firebase, enables anonymous auth with AsyncStorage persistence
  - Targets Functions region `us-central1`
  - Exposes `callGenerateLifeDemo()` which calls the callable `generateLifeDemo` and returns the download URL string

### Storage rules
- File: `storage.rules`
  - `allow read: if true;` public read for demo purposes (tighten before production)
  - `allow write: if request.auth != null;` writes require authentication (the function writes via Admin SDK)

### Build, serve, and deploy the backend

Prereqs: Firebase CLI installed and logged in, project set to `test-task-rn`.

- Install and build once:
```sh
npm --prefix functions ci
npm --prefix functions run build
```

- Run locally with the emulator (functions only):
```sh
npm --prefix functions run serve
```

- Deploy only functions (build is handled via `firebase.json` predeploy):
```sh
firebase deploy --only functions
```

Notes:
- If you need to override the font path, set `FONT_FILE` to an absolute path of a `.ttf` accessible at runtime.
- The output files are uploaded to `renders/` inside the configured Storage bucket.

### Mobile app scripts
```sh
npm run start       # Expo dev server
npm run ios         # Open iOS simulator
npm run android     # Open Android emulator
npm run web         # Web preview
```
