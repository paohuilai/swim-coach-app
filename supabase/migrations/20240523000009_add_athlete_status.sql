-- Add status fields to athletes table
ALTER TABLE athletes
ADD COLUMN status text NOT NULL DEFAULT 'training' CHECK (status IN ('training', 'paused', 'trial', 'transferred')),
ADD COLUMN status_start_date date NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN status_end_date date,
ADD COLUMN transfer_destination text,
ADD COLUMN cumulative_training_days integer DEFAULT 0;
