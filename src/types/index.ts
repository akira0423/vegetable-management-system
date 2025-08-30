export interface AuthUser {
  id: string
  email: string
  company_id: string
  role: "admin" | "manager" | "operator" | "user"
  full_name: string
}

// メンバーシップ情報を含む拡張ユーザー型
export interface AuthUserWithMembership extends AuthUser {
  membership?: {
    id: string
    role: "admin" | "manager" | "operator"
    status: "active" | "inactive" | "pending"
    phone?: string
    department?: string
    position?: string
    joined_at: string
    company: {
      name: string
      company_code?: string
      plan_type: string
      max_users: number
    }
    stats?: {
      total_logins: number
      last_login_at?: string
      reports_created: number
      photos_uploaded: number
      vegetables_managed: number
      last_activity_at?: string
    }
  }
}

export interface Database {
  // データベース型定義（後で拡張予定）
}
