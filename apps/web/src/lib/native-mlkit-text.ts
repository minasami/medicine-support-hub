/**
 * On-device ML Kit text recognition (Capacitor Android/iOS).
 * Web builds skip this and send the image to the server parser.
 */
import { Capacitor } from "@capacitor/core";

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Returns recognized text or null when the plugin is missing / web / empty.
 * Tries Capawesome ML Kit first, then Pantrist cap-6 plugin.
 */
export async function recognizeTextFromFile(file: File): Promise<string | null> {
  if (!file || !isNativePlatform()) return null;

  const dataUrl = await fileToDataUrl(file);
  const rawBase64 = dataUrl.replace(/^data:[^;]+;base64,/, "");

  try {
    const fsMod = await import("@capacitor/filesystem");
    const path = `msh-ocr-${Date.now()}.jpg`;
    await fsMod.Filesystem.writeFile({
      path,
      data: rawBase64,
      directory: fsMod.Directory.Cache,
    });
    const uri = await fsMod.Filesystem.getUri({
      path,
      directory: fsMod.Directory.Cache,
    });

    try {
      const kit = await import("@capacitor-mlkit/text-recognition");
      const Script = (kit as { Script?: { Latin: string; Chinese: string } }).Script;
      const first = await kit.TextRecognition.processImage({
        path: uri.uri,
        script: Script?.Latin,
      });
      let text = String(first?.text || "").trim();
      if (!text) {
        try {
          const second = await kit.TextRecognition.processImage({
            path: uri.uri,
            script: (Script as { Chinese?: string })?.Chinese,
          });
          text = String(second?.text || "").trim();
        } catch {
          /* Chinese/Arabic model may be absent */
        }
      }
      if (text) return text;
    } catch {
      /* plugin not installed on this binary */
    }

    try {
      const pan = await import("@pantrist/capacitor-plugin-ml-kit-text-recognition");
      const detect =
        (pan as { detectText?: (o: { base64?: string; filename?: string }) => Promise<{ text?: string }> })
          .detectText;
      if (detect) {
        const r = await detect({ base64: rawBase64, filename: uri.uri });
        if (r?.text?.trim()) return r.text.trim();
      }
    } catch {
      /* optional fallback */
    }
  } catch {
    return null;
  }
  return null;
}
