# Automated Email Campaign System - Complete Guide

## 🎯 System Overview

This is a **fully automated** email campaign system that handles everything from image generation to email delivery without manual intervention.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTOMATED WORKFLOW                        │
└─────────────────────────────────────────────────────────────┘

1. CSV Upload (Manual)
   ↓
2. Campaign Activation (Manual - "Start Campaign")
   ↓
3. CRON Job (Every 4 hours + Daily at 2 AM)
   ↓
4. auto_process_campaigns() → Finds active campaigns
   ↓
5. process-campaign-pipeline Edge Function
   ├─> Generate Composite Images (batch processing)
   ├─> Send Emails (automatic)
   └─> Update Status (real-time)
   ↓
6. Campaign Completed ✓
```

## 📅 Cron Schedule

### High-Frequency Processing
- **Schedule**: Every 4 hours
- **Times**: 12 AM, 4 AM, 8 AM, 12 PM, 4 PM, 8 PM
- **Processes**: 5 campaigns × 20 images = 100 images per run
- **Best for**: Active campaigns with steady flow

### Daily Processing
- **Schedule**: Once daily at 2 AM
- **Processes**: Same capacity (5 campaigns, 20 images each)
- **Best for**: Backup processing, catching missed campaigns

## 🔄 Processing States

Campaign `processing_status` field tracks the pipeline:

```
idle → processing_images → sending_emails → completed
                               ↓
                            error
```

### State Definitions

| State | Description | Next Action |
|-------|-------------|-------------|
| `idle` | Ready for processing | Cron can pick it up |
| `processing_images` | Generating composites | Will auto-proceed to email sending |
| `sending_emails` | Delivering emails | Will auto-proceed to completed |
| `completed` | Successfully processed | No further action |
| `error` | Failed during processing | Manual intervention required |

## 🎛️ User Interface

### Campaign Status Badges

| Badge | Meaning |
|-------|---------|
| 🖼️ Generating Images | Creating composite images |
| 📧 Sending Emails | Delivering emails |
| ✅ Completed | All done |
| ❌ Error | Failed - check logs |

### Action Buttons

#### "Process Now (Auto)" 
- **What it does**: Immediately triggers the full pipeline
- **When to use**: Testing or urgent campaigns
- **Bypasses**: Cron schedule
- **Requirements**: Campaign must be in `idle` state

#### "Generate Composites"
- **What it does**: Only generates images (no emails)
- **When to use**: Preview composites before sending
- **Batch size**: Configurable in SMTP settings

#### "Start Campaign"
- **What it does**: Activates campaign for cron processing
- **When to use**: After CSV upload and template setup
- **Effect**: Campaign will be processed on next cron run

## 🔧 Configuration

### Batch Size Settings

Default: **20 images per campaign**

To change:
```sql
UPDATE smtp_settings 
SET composite_batch_size = 50 
WHERE user_id = 'your-user-id';
```

**Recommendations**:
- Small campaigns (<50 contacts): 10-20
- Medium campaigns (50-200): 20-50
- Large campaigns (200+): 50-100

### Cron Frequency

Current setup:
- Every 4 hours (6 times per day)
- Daily at 2 AM (1 time per day)

**Total**: 7 automatic processing runs per day

To change frequency, update cron schedule:
```sql
-- Example: Run every 2 hours instead of 4
SELECT cron.schedule(
  'auto-process-campaigns-frequent',
  '0 */2 * * *',
  $$SELECT public.auto_process_campaigns();$$
);
```

## 📊 Monitoring

### Real-Time UI Updates

The UI auto-refreshes every **3 seconds** when:
- `processing_status = 'processing_images'`
- `processing_status = 'sending_emails'`

This provides live progress tracking without manual refresh.

### Database Monitoring

Check cron job history:
```sql
SELECT 
  jobid,
  runid,
  job_name,
  status,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (end_time - start_time)) as duration_seconds
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

Check active campaigns:
```sql
SELECT 
  id,
  name,
  status,
  processing_status,
  total_contacts,
  sent_count,
  pending_count,
  last_processed_at
FROM campaigns
WHERE status = 'active'
ORDER BY last_processed_at DESC;
```

## 🚨 Error Handling

### Common Issues

#### 1. Campaign Stuck in "processing_images"
**Cause**: Edge function crashed mid-execution
**Fix**:
```sql
UPDATE campaigns 
SET processing_status = 'idle' 
WHERE id = 'campaign-id';
```

#### 2. Images Generated but Emails Not Sent
**Cause**: SMTP/Resend configuration issue
**Fix**:
1. Check SMTP settings in database
2. Verify RESEND_API_KEY secret
3. Manually trigger: Click "Send Now"

#### 3. Cron Not Running
**Cause**: pg_cron extension disabled
**Fix**:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Error Recovery

The system automatically recovers from most errors:
- **Failed images**: Skips and continues with next contact
- **Failed emails**: Marks contact as 'failed', continues batch
- **Network timeouts**: Retries on next cron run

## 📈 Performance

### Throughput Capacity

**Per Cron Run**:
- 5 campaigns
- 20 images per campaign
- = 100 images per run

**Per Day** (7 runs):
- 35 campaigns
- 700 images
- 700 emails

**Per Month**:
- ~1,050 campaigns
- ~21,000 images
- ~21,000 emails

### Scaling

To increase throughput:

1. **Increase campaigns per run**:
```sql
-- Edit auto_process_campaigns() function
-- Change LIMIT 5 to LIMIT 10
```

2. **Increase batch size**:
```sql
UPDATE smtp_settings 
SET composite_batch_size = 50;
```

3. **Add more cron runs**:
```sql
-- Add hourly processing
SELECT cron.schedule(
  'auto-process-hourly',
  '0 * * * *',
  $$SELECT public.auto_process_campaigns();$$
);
```

## 🔐 Security

### Race Condition Prevention

The system prevents concurrent processing using:
1. **Status check**: Only processes campaigns in `idle` state
2. **Atomic updates**: Status changed before triggering pipeline
3. **Cron coordination**: Multiple cron jobs safely coexist

### API Key Management

All sensitive keys are stored as Supabase secrets:
- `RESEND_API_KEY` - Email delivery
- `LOVABLE_API_KEY` - AI image conversion
- `SUPABASE_SERVICE_ROLE_KEY` - Database admin access

## 🧪 Testing

### Manual Testing

1. **Create test campaign**:
   - Upload CSV with 5-10 contacts
   - Add logo URLs
   - Configure template

2. **Test pipeline**:
   - Click "Process Now (Auto)"
   - Watch status badges update
   - Verify images generated
   - Check emails received

3. **Test cron**:
   - Activate campaign (don't click Process Now)
   - Wait for next cron run (max 4 hours)
   - Verify automatic processing

### Monitoring Test Results

```sql
-- Check last processed campaigns
SELECT * FROM campaigns 
WHERE last_processed_at > NOW() - INTERVAL '1 hour'
ORDER BY last_processed_at DESC;

-- Check recent cron runs
SELECT * FROM cron.job_run_details 
WHERE start_time > NOW() - INTERVAL '1 day'
ORDER BY start_time DESC;
```

## 📝 Best Practices

### For Small Campaigns (<50 contacts)
1. Use batch size: 10-20
2. Manual trigger recommended ("Process Now")
3. Monitor progress in real-time

### For Medium Campaigns (50-200 contacts)
1. Use batch size: 20-50
2. Activate campaign, let cron handle it
3. Check progress periodically

### For Large Campaigns (200+ contacts)
1. Use batch size: 50-100
2. Activate campaign early
3. Split into multiple campaigns if urgent
4. Monitor cron job history

## 🆘 Support

### Debugging

Enable detailed logging:
```typescript
// In edge functions
console.log("[Pipeline] Step X:", data);
```

View logs in Lovable Cloud backend:
1. Open Backend
2. Navigate to Edge Functions
3. Select function
4. View Logs tab

### Common Questions

**Q: Why isn't my campaign processing?**
A: Check that `status = 'active'` and `processing_status = 'idle'`

**Q: How fast will emails send?**
A: Average 20 images + emails in ~5-10 minutes per campaign

**Q: Can I process multiple campaigns simultaneously?**
A: Yes, cron processes up to 5 campaigns per run

**Q: What happens if cron crashes?**
A: Next cron run (max 4 hours) will pick up where it left off

## 📚 Related Documentation

- [README.md](./README.md) - Main project documentation
- [COMPOSITE_IMAGES_GUIDE.md](./COMPOSITE_IMAGES_GUIDE.md) - Image generation details
- [Lovable Cloud Docs](https://docs.lovable.dev/features/cloud) - Backend features
