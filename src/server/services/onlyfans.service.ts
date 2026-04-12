/**
 * OnlyFans — pas d'API officielle.
 * prepareBundle : télécharge les médias, génère un guide de publication, crée un ZIP, upload R2, retourne URL signée 24h.
 */

import axios from "axios";
import archiver from "archiver";
import { nanoid } from "nanoid";
import { uploadFileReturnKey, getPresignedUrl } from "./storage.service";

export type ContentForBundle = {
  id: string;
  type: string;
  caption: string | null;
  hashtags: string[];
  mediaUrls: string[];
  thumbnailUrl: string | null;
  scheduledAt: Date | null;
};

/**
 * Génère le contenu du fichier publication_guide.txt
 */
function buildGuideText(content: ContentForBundle): string {
  const lines: string[] = [];
  lines.push("═══════════════════════════════════════════");
  lines.push("  GUIDE DE PUBLICATION ONLYFANS");
  lines.push("═══════════════════════════════════════════");
  lines.push("");
  lines.push("--- CAPTION (à copier-coller) ---");
  lines.push(content.caption ?? "(aucune caption)");
  lines.push("");
  if (content.hashtags.length) {
    lines.push("--- HASHTAGS ---");
    lines.push(content.hashtags.join(" "));
    lines.push("");
  }
  lines.push("--- INSTRUCTIONS ---");
  lines.push("1. Connectez-vous à OnlyFans (creator).");
  lines.push("2. Créez un nouveau post (Photo/Video selon le type).");
  lines.push("3. Collez la caption ci-dessus.");
  lines.push("4. Uploadez les médias présents dans ce ZIP (dans l'ordre pour un carousel).");
  lines.push("5. Ajoutez les hashtags si souhaité.");
  lines.push("6. Publiez.");
  lines.push("");
  const suggested = content.scheduledAt
    ? `Heure suggérée (programmée) : ${content.scheduledAt.toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}`
    : "Heure suggérée : publiez au moment où votre audience est la plus active (voir analytics).";
  lines.push("--- MEILLEURE HEURE ---");
  lines.push(suggested);
  lines.push("");
  lines.push("Ce lien de téléchargement expire dans 24 heures.");
  return lines.join("\n");
}

/**
 * Télécharge les médias du contenu, génère le guide, crée un ZIP, l'uploade sur R2.
 * Retourne une URL signée valide 24h pour télécharger le bundle.
 */
export async function prepareBundle(content: ContentForBundle): Promise<string> {
  const downloads: { buffer: Buffer; filename: string }[] = [];

  for (let i = 0; i < content.mediaUrls.length; i++) {
    const url = content.mediaUrls[i];
    const ext = url.includes(".mp4") || url.includes("video") ? "mp4" : "jpg";
    const filename = `media_${i + 1}.${ext}`;
    const buffer = await axios
      .get(url, { responseType: "arraybuffer", timeout: 60_000 })
      .then((r) => Buffer.from(r.data));
    downloads.push({ buffer, filename });
  }

  const guideText = buildGuideText(content);

  const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 6 } });

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    for (const d of downloads) {
      archive.append(d.buffer, { name: d.filename });
    }
    archive.append(guideText, { name: "publication_guide.txt" });
    archive.finalize();
  });

  const zipFilename = `onlyfans-bundle-${content.id}-${nanoid(6)}.zip`;
  const key = await uploadFileReturnKey(
    zipBuffer,
    zipFilename,
    "application/zip"
  );
  const signedUrl = await getPresignedUrl(key, 86400);
  return signedUrl;
}
