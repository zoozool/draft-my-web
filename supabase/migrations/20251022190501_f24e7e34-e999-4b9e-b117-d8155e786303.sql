-- Add delete policy for contacts table
CREATE POLICY "Users can delete contacts from their campaigns"
ON public.contacts
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM campaigns
    WHERE campaigns.id = contacts.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);