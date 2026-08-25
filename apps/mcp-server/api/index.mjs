import { handleHttp } from "../src/rpc.mjs";

export default async function handler(req, res) {
  await handleHttp(req, res);
}
