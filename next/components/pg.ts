import postgres from "postgres";

const gallerydbsql = postgres({
  host: 'localhost',      // PostgreSQL server host
  port: 5432,             // PostgreSQL port (default 5432)
  database: 'gallerydb',  // your database name
  username: 'gallery',    // your user
  password: 'gallery'     // your password
});

export { gallerydbsql };