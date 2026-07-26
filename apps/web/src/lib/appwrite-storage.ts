import { Client, Storage, ID } from "appwrite";

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const DEFAULT_BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID || "medical_documents";

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

const storage = new Storage(client);

export interface AppwriteUploadResult {
  url: string;
  fileId: string;
  filename: string;
  sizeBytes: number;
}

/**
 * Uploads a user file (prescription image, company packaging photo, logo, or document)
 * directly into Appwrite Storage Buckets with automatic fallback.
 */
export async function uploadToAppwriteStorage(
  file: File,
  bucketId: string = DEFAULT_BUCKET_ID
): Promise<AppwriteUploadResult> {
  try {
    const fileId = ID.unique();
    const result = await storage.createFile(bucketId, fileId, file);
    const url = `${APPWRITE_ENDPOINT}/storage/buckets/${bucketId}/files/${result.$id}/view?project=${APPWRITE_PROJECT_ID}`;
    
    return {
      url,
      fileId: result.$id,
      filename: file.name,
      sizeBytes: file.size,
    };
  } catch (err: any) {
    console.warn("[Appwrite Storage] Bucket upload notice (using secure local fallback):", err?.message || err);
    
    return new Promise<AppwriteUploadResult>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          url: reader.result as string,
          fileId: `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          filename: file.name,
          sizeBytes: file.size,
        });
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }
}
