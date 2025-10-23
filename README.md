# Logo Mailer - Email Campaign Management Platform

A full-stack email campaign management application built with React, TypeScript, and Lovable Cloud (Supabase).

## Project Info

**URL**: https://lovable.dev/projects/5e893ca4-a132-449e-90c5-f183f99db5b7

## Features

- 📧 **Email Campaign Management** - Create and manage email campaigns with personalized templates
- 🤖 **Automated Pipeline** - Fully automated image generation and email sending via cron jobs
- 🖼️ **Composite Image Generation** - Automatically generate personalized images by compositing company logos onto base templates
- ⏰ **Scheduled Processing** - Cron jobs run every 4 hours (and daily at 2 AM) to process active campaigns
- 📊 **Analytics Dashboard** - Real-time tracking of sent, pending, and failed emails with live status updates
- 📁 **CSV Import** - Bulk import contacts via CSV upload with logo URL support
- 🎨 **Template Personalization** - Dynamic template variables ({{first_name}}, {{last_name}}, {{company}}, {{email}}, {{composite_image}})
- 🎯 **Logo Placement Control** - Configurable quadrilateral coordinates for precise logo positioning
- 🔐 **Secure Authentication** - User authentication with Lovable Cloud Auth
- 📈 **Campaign Analytics** - Visual charts showing campaign performance and success rates
- 🔄 **Batch Processing** - Configurable batch size (default: 20) for composite image generation
- 📸 **Image Gallery** - Browse and download generated composite images
- 🎛️ **Manual Override** - "Process Now" button for immediate pipeline execution
- 🔄 **Auto-Refresh UI** - Real-time status updates when processing is active

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn-ui components
- **Backend**: Lovable Cloud (Supabase)
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Email Service**: Resend API
- **Charts**: Recharts

## Database Schema

### Tables

**campaigns**
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users)
- `name` (text)
- `subject` (text)
- `body_template` (text) - Email template with variable placeholders
- `status` (text) - 'draft', 'sending', 'completed'
- `total_contacts` (integer)
- `sent_count` (integer)
- `failed_count` (integer)
- `pending_count` (integer)
- `created_at` (timestamp)

**contacts**
- `id` (uuid, primary key)
- `campaign_id` (uuid, references campaigns)
- `email` (text)
- `first_name` (text)
- `last_name` (text)
- `company` (text)
- `logo_url` (text) - URL to company logo
- `composite_image_url` (text) - URL to generated composite image
- `status` (text) - 'pending', 'sent', 'failed'
- `sent_at` (timestamp)
- `error_message` (text)
- `created_at` (timestamp)

**smtp_settings**
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users)
- `smtp_host` (text)
- `smtp_port` (integer)
- `smtp_username` (text)
- `smtp_password` (text)
- `smtp_from_name` (text)
- `smtp_from_email` (text)
- `use_tls` (boolean)
- `is_active` (boolean)
- `composite_batch_size` (integer) - Number of images to generate per batch
- `emails_per_hour_limit` (integer)
- `created_at` (timestamp)
- `updated_at` (timestamp)

## Edge Functions

### process-campaign-pipeline (NEW - Orchestrator)
**Path**: `supabase/functions/process-campaign-pipeline/index.ts`

**Master orchestrator that automates the entire workflow:**
1. Checks campaign status and pending work
2. Generates composite images in batches (respects `composite_batch_size`)
3. Sends emails automatically after images are ready
4. Updates `processing_status` throughout the pipeline
5. Handles errors gracefully with status rollback

**Request Body**:
```json
{
  "campaignId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Campaign pipeline completed successfully",
  "imagesProcessed": 47,
  "emailsSent": 47,
  "emailsFailed": 0
}
```

**Processing Flow**:
```
idle → processing_images → sending_emails → completed
                                ↓
                             error (on failure)
```

### process-csv
**Path**: `supabase/functions/process-csv/index.ts`

Processes CSV file uploads and imports contacts into campaigns.

**Request Body**:
```json
{
  "campaignId": "uuid",
  "csvContent": "email,first_name,last_name,company\nuser@example.com,John,Doe,Acme Inc"
}
```

**Features**:
- Validates CSV format and email addresses
- Bulk inserts contacts into database
- Updates campaign contact counts

### send-emails
**Path**: `supabase/functions/send-emails/index.ts`

Sends personalized emails to campaign contacts using Resend API.

**Request Body**:
```json
{
  "campaignId": "uuid"
}
```

**Features**:
- Fetches pending contacts for campaign
- Personalizes email templates with contact data
- Sends emails via Resend API
- Updates contact and campaign status
- Tracks sent/failed counts

### generate-composite-images
**Path**: `supabase/functions/generate-composite-images/index.ts`

Generates composite images by overlaying company logos onto a base template image.

**Request Body**:
```json
{
  "campaignId": "uuid",
  "baseImageUrl": "optional-url-to-base-image",
  "limit": 5
}
```

**Features**:
- Processes contacts with logo URLs but no composite images
- Supports PNG, JPEG, SVG, and WebP formats
- SVG conversion via resvg WASM rasterization
- WebP conversion via Lovable AI (Gemini 2.5 Flash)
- Configurable quadrilateral logo placement with perspective
- Automatic aspect ratio preservation
- Batch processing with configurable limits
- Error handling and skip-on-failure logic
- Uploads generated images to Supabase Storage
- Updates contact records with composite image URLs

**Supported Logo Formats**:
- PNG (native support)
- JPEG/JPG (native support)
- SVG (converted to PNG via resvg)
- WebP (converted to PNG via AI)

**Logo Placement Coordinates**:
Default quadrilateral coordinates for logo placement:
- Top-Left: (888, 500)
- Top-Right: (1201, 493)
- Bottom-Right: (1198, 724)
- Bottom-Left: (886, 726)

These can be customized in the campaign detail page UI.

## Setting Up Cron Jobs

You can schedule automated email sends in two ways:

### Option 1: External Cron (From Your Own Server/VPS)

If you want to run cron jobs from your own server, use this approach:

1. Open crontab editor on your server:
```bash
crontab -e
```

2. Add this line (example runs every minute):
```bash
* * * * * curl -s -X POST "https://wnmfjueqkrvfnlvfgcvn.supabase.co/functions/v1/send-emails" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubWZqdWVxa3J2Zm5sdmZnY3ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NDMzMTEsImV4cCI6MjA3NjIxOTMxMX0.i3MUrWw6CYnxZNQddFuqcwXsqw_cUUOnpwayX2oOdtg" \
  -d '{}' >> /var/log/supabase-cron.log 2>&1
```

**⚠️ Important Notes:**
- The URL MUST be `https://wnmfjueqkrvfnlvfgcvn.supabase.co/functions/v1/send-emails` (Supabase edge function URL)
- Do NOT use your VPS IP or frontend URL (e.g., `http://107.150.1.200:3000`)
- The Authorization header uses your Supabase anon key (already included above)
- Logs will be written to `/var/log/supabase-cron.log`

### Option 2: Supabase Built-in Cron (pg_cron)

Use Lovable Cloud's built-in scheduling capabilities:

#### Enable Extensions

Run in your Lovable Cloud backend SQL editor:

```sql
-- Enable cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable HTTP request extension
CREATE EXTENSION IF NOT EXISTS pg_net;
```

#### Schedule Automated Email Sends

```sql
SELECT cron.schedule(
  'send-campaign-emails-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://wnmfjueqkrvfnlvfgcvn.supabase.co/functions/v1/send-emails',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubWZqdWVxa3J2Zm5sdmZnY3ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NDMzMTEsImV4cCI6MjA3NjIxOTMxMX0.i3MUrWw6CYnxZNQddFuqcwXsqw_cUUOnpwayX2oOdtg"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

**How it works:**
1. Cron triggers the edge function on schedule (e.g., every hour)
2. Edge function queries for all campaigns with `status = 'sending'` and `pending_count > 0`
3. Processes up to 50 contacts per campaign per run
4. Updates campaign status to 'completed' when all contacts are processed

You can also trigger specific campaigns by passing a `campaignId`:
```sql
body := '{"campaignId": "your-campaign-uuid-here"}'::jsonb
```

### Cron Schedule Examples

```bash
'* * * * *'       # Every minute
'*/5 * * * *'     # Every 5 minutes
'0 * * * *'       # Every hour
'0 */6 * * *'     # Every 6 hours
'0 9 * * *'       # Daily at 9 AM
'0 9 * * 1'       # Every Monday at 9 AM
```

### Manage Cron Jobs (pg_cron only)

```sql
-- List all cron jobs
SELECT * FROM cron.job;

-- Unschedule a job
SELECT cron.unschedule('send-campaign-emails-hourly');

-- Update a job schedule
SELECT cron.alter_job(
  job_id := 1,
  schedule := '*/10 * * * *' -- Change to every 10 minutes
);
```

## Environment Variables

Required secrets (automatically configured in Lovable Cloud):

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key
- `VITE_SUPABASE_PROJECT_ID` - Project identifier
- `SUPABASE_URL` - Supabase URL for edge functions
- `SUPABASE_ANON_KEY` - Supabase anon key for edge functions
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key for edge functions
- `RESEND_API_KEY` - Resend API key for email sending
- `LOVABLE_API_KEY` - Lovable AI API key for image processing (WebP conversion, AI features)

## Row Level Security (RLS)

All tables have RLS enabled with user-scoped policies:

- Users can only view/manage their own campaigns
- Users can only access contacts from their campaigns
- Users can only access their own SMTP settings
- Automatic user_id enforcement on INSERT operations

## Storage Buckets

**logos** (Public)
- Stores company logos uploaded or fetched from URLs
- Stores base template images for composite generation
- Stores generated composite images in `composites/` folder
- Stores SVG conversions in `svg-converted/` folder

**csv-uploads** (Private)
- Stores uploaded CSV files for contact imports
- User-scoped access via RLS

## Contact List Color Coding

The email list uses color coding to quickly identify contact status:

- 🔴 **Red** - Missing email address
- 🟠 **Orange** - Missing logo URL
- 🔵 **Blue** - Missing composite image (logo URL present)
- ⚪ **Default** - Complete (has email, logo, and composite image)

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/5e893ca4-a132-449e-90c5-f183f99db5b7) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/5e893ca4-a132-449e-90c5-f183f99db5b7) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
