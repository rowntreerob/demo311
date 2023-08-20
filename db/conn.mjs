import { MongoClient } from "mongodb";

const DBKEY = process.env.DB_URI || "";
const client = new MongoClient(DBKEY);

let conn;
try {
  conn = await client.connect();
} catch(e) {
  console.error(e);
}

let db = conn.db("org311");

export default db;
