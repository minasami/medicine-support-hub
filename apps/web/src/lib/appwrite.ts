import { Client, Account, Databases, Storage, Functions } from "appwrite";

const APPWRITE_ENDPOINT =
  import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;

if (!APPWRITE_PROJECT_ID) {
  throw new Error(
    "VITE_APPWRITE_PROJECT_ID is required to initialize the Appwrite client.",
  );
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);
const functions = new Functions(client);

// Safely ping Appwrite backend server to verify SDK setup without breaking TypeScript compiler.
if (typeof window !== "undefined") {
  const pingMethod = (client as any)?.ping;
  if (typeof pingMethod === "function") {
    pingMethod
      .call(client)
      .then(() =>
        console.log(
          `✓ Appwrite SDK successfully connected and verified (${APPWRITE_ENDPOINT}).`,
        ),
      )
      .catch((err: any) =>
        console.warn("ℹ️ Appwrite ping notice:", err?.message || err),
      );
  }
}

export { client, account, databases, storage, functions };
