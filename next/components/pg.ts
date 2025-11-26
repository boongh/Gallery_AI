import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();

const gallerydbsql = postgres({
  host: process.env.PGHOST,      // PostgreSQL server host
  port: 5432,             // PostgreSQL port (default 5432)
  database: process.env.PGDATABASE,  // your database name
  user: process.env.PGUSER,    // your user
  password: process.env.PGPASSWORD     // your password
});

export { gallerydbsql };