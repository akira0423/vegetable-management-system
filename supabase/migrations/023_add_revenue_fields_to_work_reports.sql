-- Add revenue fields to work_reports table
ALTER TABLE work_reports 
ADD COLUMN IF NOT EXISTS expected_revenue DECIMAL(12,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sales_amount DECIMAL(12,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(12,2) DEFAULT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_work_reports_expected_revenue ON work_reports(expected_revenue);
CREATE INDEX IF NOT EXISTS idx_work_reports_sales_amount ON work_reports(sales_amount);

-- Add comments for documentation
COMMENT ON COLUMN work_reports.expected_revenue IS '予想売上高（円）';
COMMENT ON COLUMN work_reports.sales_amount IS '実際の売上高（円）';
COMMENT ON COLUMN work_reports.estimated_cost IS '推定コスト（円）';