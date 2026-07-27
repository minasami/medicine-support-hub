import { Client, Account, Databases, Storage, Functions } from "appwrite";

const client = new Client()
    .setEndpoint("https://fra.cloud.appwrite.io/v1")
    .setProject("6a54ac3a00272c02d6e0");

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);
const functions = new Functions(client);

// Ping Appwrite backend server to verify SDK setup on client initialization
if (typeof window !== "undefined") {
    client.ping()
        .then(() => console.log("✓ Appwrite SDK successfully connected and verified (fra.cloud.appwrite.io)."))
        .catch((err) => console.warn("ℹ️ Appwrite ping notice:", err?.message || err));
}

export { client, account, databases, storage, functions };
