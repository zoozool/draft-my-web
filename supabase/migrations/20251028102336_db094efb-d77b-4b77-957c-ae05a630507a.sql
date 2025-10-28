-- Create error logs table
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  log_type TEXT NOT NULL CHECK (log_type IN ('edge', 'auth', 'db', 'client')),
  level TEXT NOT NULL CHECK (level IN ('error', 'warning', 'info')),
  function_name TEXT,
  error_message TEXT NOT NULL,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_error_logs_user_id ON public.error_logs(user_id);
CREATE INDEX idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX idx_error_logs_log_type ON public.error_logs(log_type);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own logs
CREATE POLICY "Users can view their own error logs"
  ON public.error_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own logs
CREATE POLICY "Users can insert their own error logs"
  ON public.error_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow service role to insert logs (for edge functions)
CREATE POLICY "Service role can insert error logs"
  ON public.error_logs
  FOR INSERT
  WITH CHECK (true);