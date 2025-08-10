import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import { fileSync } from 'tmp';
import { v4 as uuidv4 } from 'uuid';
import { unlinkSync, existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import path from 'path';

const STORAGE_BUCKET = 'test-task-rn.firebasestorage.app';
admin.initializeApp({ storageBucket: STORAGE_BUCKET } as any);

(ffmpeg as any).setFfmpegPath(ffmpegPath.path);
(ffmpeg as any).setFfprobePath(ffprobePath.path);

const SAMPLE_VIDEO_URL = 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4';

const ASSET_FONT = path.join(__dirname, '../assets/font.ttf');
const ENV_FONT = process.env.FONT_FILE || '';

const sQuote = (v: string) => `'${String(v).replace(/'/g, "\\'")}'`;

export const generateLifeDemo = functions
  .runWith({ memory: '1GB', timeoutSeconds: 540 })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const tmpIn = fileSync({ postfix: '.mp4' });
    const tmpOut = fileSync({ postfix: '.mp4' });

    try {
      const res = await fetch(SAMPLE_VIDEO_URL);
      if (!res.ok) {
        throw new Error(`Failed to download sample: ${res.status} ${res.statusText}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      await writeFile(tmpIn.name, buffer);

      let fontPath: string | undefined;

      if (existsSync(ASSET_FONT)) {
        fontPath = ASSET_FONT;
      } else if (ENV_FONT && existsSync(ENV_FONT)) {
        fontPath = ENV_FONT;
      } else {
        throw new Error('No font available. Place font.ttf in functions/src/assets or set FONT_FILE env var to a readable .ttf file.');
      }

      const fontSize = 72;
      const text = 'Life Demo';

      const drawText =
        `drawtext=` +
        `fontfile=${sQuote(fontPath!)}:` +
        `text=${sQuote(text)}:` +
        `fontcolor=yellow:` +
        `fontsize=${fontSize}:` +
        `x=(w-text_w)/2:y=(h-text_h)/2`;

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(tmpIn.name)
          .outputOptions('-t', '10')
          .complexFilter([
            '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,setsar=1[vscaled]',
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
          .on('stderr', (line: string) => {
            console.log(`ffmpeg stderr: ${line}`);
          })
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });

      const bucket = admin.storage().bucket(STORAGE_BUCKET);
      console.log('Using storage bucket:', STORAGE_BUCKET);
      const objectName = `renders/life-demo-${uuidv4()}.mp4`;
      const downloadToken = uuidv4();
      await bucket.upload(tmpOut.name, {
        destination: objectName,
        contentType: 'video/mp4',
        metadata: {
          cacheControl: 'public, max-age=86400',
          metadata: { firebaseStorageDownloadTokens: downloadToken },
        },
      });

      const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(objectName)}?alt=media&token=${downloadToken}`;

      return { url, objectName, bucket: bucket.name };
    } catch (err) {
      console.error(err);
      throw new functions.https.HttpsError('internal', (err as Error).message);
    } finally {
      try { unlinkSync(tmpIn.name); } catch {}
      try { unlinkSync(tmpOut.name); } catch {}
      try { tmpIn.removeCallback(); } catch {}
      try { tmpOut.removeCallback(); } catch {}
    }
  });
  