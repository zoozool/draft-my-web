# Logo Composite Image Generation - Complete Guide

## Current Status: NO IMAGE COMPOSITING IMPLEMENTED

Your current system only stores logo URLs and inserts them directly into emails. This guide shows you how to implement proper image compositing.

## Architecture Overview

```
CSV Upload → Database → Generate Composites → Store in Storage → Send Emails
```

## What's Been Built

### 1. Database Schema
- Added `composite_image_url` column to `contacts` table
- Stores generated composite images separately from original logo URLs

### 2. Edge Function: `generate-composite-images`
**Purpose:** Generate personalized composite images for each contact

**Features:**
- ✅ Fetches all contacts without composite images
- ✅ Uses Lovable AI to composite logos onto base images
- ✅ Handles perspective transformation via AI instructions
- ✅ Uploads generated images to Supabase Storage (logos bucket)
- ✅ Updates contacts with composite image URLs
- ✅ Batch processing with error handling
- ✅ Fallback to original logo URL if generation fails

**Coordinates Support:**
```typescript
{
  topLeft: { x: 888, y: 500 },
  topRight: { x: 1201, y: 493 },
  bottomRight: { x: 1198, y: 724 },
  bottomLeft: { x: 886, y: 726 }
}
```

**Simple Mode:**
- Target area: 313px × 226px
- Maintains aspect ratio
- Centers logo in rectangle

### 3. Updated Email Sending
- Uses `{{composite_image}}` variable for generated composites
- Falls back to `{{logo_url}}` if composite not available
- Backward compatible with existing templates

### 4. UI Integration
- "Generate Composites" button on Campaign Detail page
- Shows progress and results
- Only appears for draft campaigns

## How to Use

### Step 1: Enable Lovable AI (Required for Image Generation)

The composite generation uses Lovable AI Gateway which requires the `LOVABLE_API_KEY`:

```bash
# This is automatically available in your Lovable Cloud environment
# No manual setup needed!
```

### Step 2: Update Email Template

Use the new variable in your email body:

```html
<div style="text-align: center;">
  <img src="{{composite_image}}" 
       alt="{{company}} personalized graphic" 
       style="max-width: 100%; height: auto;" />
</div>

<p>Hello {{first_name}},</p>
<p>We've created this personalized graphic just for {{company}}!</p>
```

### Step 3: Generate Composites

1. Go to Campaign Detail page
2. Click "Generate Composites" button
3. Wait for processing (may take 30-60 seconds for large campaigns)
4. Check results in contact list

### Step 4: Send Emails

Once composites are generated, start the campaign as normal. Emails will automatically use the composite images.

## API Reference

### Generate Composites Endpoint

```typescript
POST /functions/v1/generate-composite-images

Body:
{
  "campaignId": "uuid",
  "baseImageUrl": "https://...", // Optional
  "coordinates": { // Optional, defaults shown
    "topLeft": { "x": 888, "y": 500 },
    "topRight": { "x": 1201, "y": 493 },
    "bottomRight": { "x": 1198, "y": 724 },
    "bottomLeft": { "x": 886, "y": 726 }
  },
  "simpleMode": true, // Use simple rectangle vs perspective
  "targetWidth": 313,
  "targetHeight": 226
}

Response:
{
  "success": true,
  "processed": 10,
  "successful": 9,
  "failed": 1,
  "errors": ["contact@example.com: Error message"]
}
```

## Email Template Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{composite_image}}` | Generated composite image URL | Full personalized graphic |
| `{{logo_url}}` | Original logo URL from CSV | Just the logo |
| `{{company}}` | Company name | "Acme Corp" |
| `{{first_name}}` | Contact first name | "John" |
| `{{last_name}}` | Contact last name | "Doe" |
| `{{contact}}` | Full name | "John Doe" |
| `{{email}}` | Email address | "john@example.com" |

## Production Considerations

### Performance
- **Batch Size:** Currently processes all contacts at once
- **Time:** ~3-5 seconds per image with AI generation
- **Recommendation:** For 100+ contacts, add batch processing with queue

### Cost
- **AI Generation:** Uses Lovable AI credits (check pricing)
- **Storage:** Supabase Storage costs (logos bucket)
- **Alternative:** Use external service like imgix or cloudinary

### Error Handling
- ✅ Graceful fallback to original logo URL
- ✅ Per-contact error logging
- ✅ Continues processing if individual contacts fail
- ✅ Reports summary at end

### Scaling Improvements Needed

1. **Add Queue System**
```typescript
// Instead of processing all at once
// Use a queue like BullMQ or Supabase Edge Functions with retry
```

2. **Add Progress Tracking**
```sql
ALTER TABLE campaigns 
ADD COLUMN composites_generated INTEGER DEFAULT 0,
ADD COLUMN composites_total INTEGER DEFAULT 0;
```

3. **Add Caching**
```typescript
// Cache identical logos
// Store logo hash and reuse composite if same logo used multiple times
```

4. **Alternative: Client-Side Generation**
```typescript
// Use HTML5 Canvas API in browser
// Generate composites before upload
// Pros: No server cost
// Cons: Slower user experience
```

## Troubleshooting

### Images Not Generating
1. Check `LOVABLE_API_KEY` is set
2. Verify logo URLs are accessible
3. Check edge function logs
4. Ensure logos bucket exists and is public

### Poor Quality Composites
1. Adjust AI prompt in edge function
2. Provide higher resolution base image
3. Use perspective mode for better placement
4. Consider using dedicated image processing library

### Slow Generation
1. Enable batch processing
2. Use simpler base images
3. Consider pre-generating during off-peak hours
4. Cache common logos

## Advanced: Custom Image Processing

If you need pixel-perfect control without AI:

```typescript
// Use sharp library (requires Node.js environment)
// Or use external service like imgix

// Example with imgix:
const compositeUrl = `https://your-imgix-domain.imgix.net/${baseImage}?`
  + `mark=${encodeURIComponent(logoUrl)}`
  + `&mark-w=313&mark-h=226`
  + `&mark-x=888&mark-y=500`
  + `&mark-fit=max`;
```

## Next Steps

1. ✅ Database schema added
2. ✅ Edge function created
3. ✅ Email integration updated
4. ✅ UI button added
5. ⏳ Enable Lovable AI (automatic)
6. ⏳ Test with sample campaign
7. ⏳ Monitor performance
8. ⏳ Optimize based on usage

## Questions?

- Check edge function logs for detailed error messages
- Use "Generate Composites" button to test
- Start with small campaigns (5-10 contacts) first
