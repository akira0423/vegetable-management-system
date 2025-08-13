export interface AuthUser {
  id: string
  email: string
  company_id: string
  role: "admin" | "manager" | "operator"
  full_name: string
}

export interface Database {
  // データベース型定義（後で拡張予定）
}
