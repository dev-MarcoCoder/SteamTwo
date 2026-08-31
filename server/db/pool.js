import pg from "pg";

const { Pool } = pg;

/** Creates a PostgreSQL pool. It is deliberately lazy: importing the API does not require a database. */
export function createPool(connectionString, options = {}) {
  if (!connectionString) throw new Error("DATABASE_URL é obrigatória para acessar o banco de dados.");
  return new Pool({ connectionString, ...options });
}

export async function withTransaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
