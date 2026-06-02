import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

// Create a connection pool instead of a single connection for better performance and concurrency
export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "banana",
  waitForConnections: true,
  connectionLimit: 20,    // ลดจาก 300 → 20 (เหมาะกับ MySQL 5.7 ทั่วไป)
  queueLimit: 50,
  connectTimeout: 30000,  // เพิ่มจาก 10s → 30s สำหรับ network ช้า
  dateStrings: true,
});


