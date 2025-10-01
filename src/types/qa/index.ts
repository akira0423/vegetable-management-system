// Q&Aプラットフォーム型定義

export type QuestionStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'FUNDED'
  | 'ANSWERING'
  | 'SELECTING'
  | 'CLOSED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'DISPUTED';

export type PaymentType =
  | 'ESCROW'
  | 'PPV'
  | 'TIP'
  | 'REFUND'
  | 'WITHDRAWAL';

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export type UserTier =
  | 'BRONZE'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'VERIFIED';

export type NotificationType =
  | 'NEW_ANSWER'
  | 'BEST_SELECTED'
  | 'PAYMENT_RECEIVED'
  | 'PPV_PURCHASE'
  | 'TIP_RECEIVED'
  | 'DEADLINE_REMINDER'
  | 'SYSTEM';

export interface Question {
  id: string;
  asker_id: string;
  title: string;
  body: string;
  body_preview?: string;
  bounty_amount: number;
  status: QuestionStatus;
  deadline_at: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  best_answer_id?: string;
  best_selected_at?: string;
  closed_at?: string;
  category?: string;
  tags?: string[];
  attachments?: any[];
  answer_count?: number;
  view_count?: number;
  ppv_purchase_count?: number;
  stripe_payment_intent_id?: string;
  // 回答品質要件
  min_answer_chars?: number;
  require_photo?: boolean;
  require_photo_min?: number;
  require_video?: boolean;
  require_video_min?: number;
  requirements_locked_at?: string;
}

export interface Answer {
  id: string;
  question_id: string;
  responder_id: string;
  body: string;
  body_preview?: string;
  is_best: boolean;
  created_at: string;
  updated_at: string;
  upvotes?: number;
  downvotes?: number;
  attachments?: any[];
}

export interface Transaction {
  id: string;
  type: PaymentType;
  status: PaymentStatus;
  amount: number;
  platform_fee?: number;
  net_amount?: number;
  from_user_id?: string;
  to_user_id?: string;
  question_id?: string;
  answer_id?: string;
  stripe_payment_intent_id?: string;
  stripe_charge_id?: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  expertise_areas?: string[];
  tier: UserTier;
  reputation_score: number;
  total_questions: number;
  total_answers: number;
  total_best_answers: number;
  best_answer_rate: number;
  stripe_customer_id?: string;
  stripe_account_id?: string;
  stripe_account_status?: string;
  stripe_onboarding_completed?: boolean;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance_available: number;
  balance_pending: number;
  balance_withdrawn: number;
  total_earned: number;
  updated_at: string;
}

export interface AnswerRequirements {
  min_answer_chars?: number;
  require_photo?: boolean;
  require_photo_min?: number;
  require_video?: boolean;
  require_video_min?: number;
}

export interface CreateQuestionDto {
  title: string;
  body: string;
  preview?: string;
  bounty_amount: number;
  deadline_at?: string;
  category?: string;
  tags?: string[];
  attachments?: any[];
  requirements?: AnswerRequirements;
}

export interface CreateAnswerDto {
  body: string;
  attachments?: any[];
}

export interface SelectBestAnswerDto {
  answer_id: string;
}

export interface PurchasePPVDto {
  question_id: string;
}