"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLifeDemo = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const ffmpeg_1 = __importDefault(require("@ffmpeg-installer/ffmpeg"));
const ffprobe_1 = __importDefault(require("@ffprobe-installer/ffprobe"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const tmp_1 = require("tmp");
const uuid_1 = require("uuid");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
// Use the explicit Firebase Storage bucket (GCS bucket name)
const STORAGE_BUCKET = 'test-task-rn.firebasestorage.app';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
admin.initializeApp({ storageBucket: STORAGE_BUCKET });
// Configure fluent-ffmpeg binaries
// eslint-disable-next-line @typescript-eslint/no-explicit-any
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_1.default.path);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
fluent_ffmpeg_1.default.setFfprobePath(ffprobe_1.default.path);
// Replace with your own stock clip if desired
const SAMPLE_VIDEO_URL = 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4';
const ASSET_FONT = path_1.default.join(__dirname, '../assets/font.ttf');
const ENV_FONT = process.env.FONT_FILE || '';
// Font is expected to be bundled with the function at ../assets/font.ttf after build.
// Safe single-quote wrapper for ffmpeg filter values
const sQuote = (v) => `'${String(v).replace(/'/g, "\\'")}'`;
exports.generateLifeDemo = functions
    .runWith({ memory: '1GB', timeoutSeconds: 540 })
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const tmpIn = (0, tmp_1.fileSync)({ postfix: '.mp4' });
    const tmpOut = (0, tmp_1.fileSync)({ postfix: '.mp4' });
    try {
        // Download sample video
        const res = await fetch(SAMPLE_VIDEO_URL);
        if (!res.ok) {
            throw new Error(`Failed to download sample: ${res.status} ${res.statusText}`);
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        await (0, promises_1.writeFile)(tmpIn.name, buffer);
        // Ensure there is a font we can use with drawtext.
        // Preference: packaged asset -> env-provided local file. No remote fetching.
        let fontPath;
        if ((0, fs_1.existsSync)(ASSET_FONT)) {
            fontPath = ASSET_FONT;
        }
        else if (ENV_FONT && (0, fs_1.existsSync)(ENV_FONT)) {
            fontPath = ENV_FONT;
        }
        else {
            throw new Error('No font available. Place font.ttf in functions/src/assets or set FONT_FILE env var to a readable .ttf file.');
        }
        // Build FFmpeg command for 9:16 vertical, 10s, centered text overlay
        const fontSize = 72; // tweak as needed for 1080x1920
        const text = 'Life Demo';
        // Keep drawtext simple to avoid filter parsing issues on some ffmpeg builds
        const drawText = `drawtext=` +
            `fontfile=${sQuote(fontPath)}:` +
            `text=${sQuote(text)}:` +
            `fontcolor=yellow:` +
            `fontsize=${fontSize}:` +
            `x=(w-text_w)/2:y=(h-text_h)/2`;
        await new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)()
                .input(tmpIn.name)
                .outputOptions('-t', '10') // 10 seconds total
                .complexFilter([
                // Scale while preserving aspect ratio without using if() expressions
                '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,setsar=1[vscaled]',
                // Pad to exact 1080x1920 canvas and center the scaled video
                '[vscaled]pad=1080:1920:(1080-iw)/2:(1920-ih)/2:black[base]',
                `[base]${drawText}[outv]`,
            ])
                .outputOptions(['-map', '[outv]', '-map', '0:a?', '-shortest'])
                .videoCodec('libx264')
                .audioCodec('aac')
                .outputOptions('-movflags', '+faststart')
                .outputOptions('-preset', 'veryfast')
                .outputOptions('-crf', '23')
                .output(tmpOut.name)
                .on('stderr', (line) => {
                console.log(`ffmpeg stderr: ${line}`);
            })
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });
        const bucket = admin.storage().bucket(STORAGE_BUCKET);
        console.log('Using storage bucket:', STORAGE_BUCKET);
        const objectName = `renders/life-demo-${(0, uuid_1.v4)()}.mp4`;
        const downloadToken = (0, uuid_1.v4)();
        await bucket.upload(tmpOut.name, {
            destination: objectName,
            contentType: 'video/mp4',
            metadata: {
                cacheControl: 'public, max-age=86400',
                metadata: { firebaseStorageDownloadTokens: downloadToken },
            },
        });
        // Construct Firebase Storage download URL (no IAM signing required)
        const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(objectName)}?alt=media&token=${downloadToken}`;
        return { url, objectName, bucket: bucket.name };
    }
    catch (err) {
        console.error(err);
        throw new functions.https.HttpsError('internal', err.message);
    }
    finally {
        try {
            (0, fs_1.unlinkSync)(tmpIn.name);
        }
        catch { }
        try {
            (0, fs_1.unlinkSync)(tmpOut.name);
        }
        catch { }
        try {
            tmpIn.removeCallback();
        }
        catch { }
        try {
            tmpOut.removeCallback();
        }
        catch { }
    }
});
