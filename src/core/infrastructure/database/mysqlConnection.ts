import mysql, { type Pool, type PoolConnection } from "mysql2/promise";

const poolConfig = {
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3314),
  database: process.env.DB_NAME ?? "punto_venta",
  user: process.env.DB_USER ?? "punto_venta",
  password: process.env.DB_PASSWORD ?? "punto_venta_dev",
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
  queueLimit: 0,
  decimalNumbers: true,
};

let pool: Pool | undefined;

export function getMysqlPool(): Pool {
  if (!pool) {
    pool = mysql.createPool(poolConfig);
  }

  return pool;
}

export async function withTransaction<T>(
  operation: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await getMysqlPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
