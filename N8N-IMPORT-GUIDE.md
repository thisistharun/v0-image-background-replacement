# n8n Workflows Import Guide

I've created 4 separate n8n workflow files that you can import directly.

## Files Created

1. `n8n-workflow-front.json` - Generates front view
2. `n8n-workflow-left.json` - Generates left view
3. `n8n-workflow-right.json` - Generates right view
4. `n8n-workflow-back.json` - Generates back view

## How to Import

### For Each Workflow File:

1. **Open n8n**
2. Click **"+ Add workflow"** (top left)
3. Click the **"⋮"** menu (three dots, top right)
4. Select **"Import from File"**
5. Choose one of the JSON files (e.g., `n8n-workflow-front.json`)
6. Click **"Import"**

### After Importing:

1. **Update Credentials**
   - Click on the "Gemini" node
   - Select your Google Gemini API credentials
   - If not set up, click "Create New Credential" and add your API key

2. **Activate the Workflow**
   - Toggle the switch in top right from "Inactive" to "Active"

3. **Note the Webhook URL**
   - Click on the "Webhook" node
   - Copy the "Production URL" (should be like `https://tharunkalluru.app.n8n.cloud/webhook/imagebg-front`)

4. **Repeat for All 4 Workflows**

## Verify Webhook URLs

After importing all 4, you should have these webhook URLs:

- ✅ `https://tharunkalluru.app.n8n.cloud/webhook/imagebg-front`
- ✅ `https://tharunkalluru.app.n8n.cloud/webhook/imagebg-left`
- ✅ `https://tharunkalluru.app.n8n.cloud/webhook/imagebg-right`
- ✅ `https://tharunkalluru.app.n8n.cloud/webhook/imagebg-back`

## Testing

### Test Individual Workflow:

```bash
curl -X POST https://tharunkalluru.app.n8n.cloud/webhook/imagebg-front \
  -F "edited=@path/to/your/image.jpg" \
  --output front-view.png
```

### Test with Frontend:

1. Refresh your browser at http://localhost:3001
2. Upload an image
3. Click "Replace Background"
4. Click "Generate Multi Views"
5. Should complete in ~15 seconds with all 4 views!

## What Each Workflow Does

### Front View Workflow
- Receives image via POST to `/webhook/imagebg-front`
- Sends to Gemini with "Front view catalog shot" prompt
- Returns PNG binary directly

### Left View Workflow
- Receives image via POST to `/webhook/imagebg-left`
- Sends to Gemini with "Left profile catalog shot" prompt
- Returns PNG binary directly

### Right View Workflow
- Receives image via POST to `/webhook/imagebg-right`
- Sends to Gemini with "Right profile catalog shot" prompt
- Returns PNG binary directly

### Back View Workflow
- Receives image via POST to `/webhook/imagebg-back`
- Sends to Gemini with "Back view catalog shot" prompt
- Returns PNG binary directly

## Benefits

✅ **TRUE Parallel Execution** - All 4 run simultaneously  
✅ **75% Faster** - 15 seconds instead of 60 seconds  
✅ **Simple & Clean** - Each workflow is identical, easy to maintain  
✅ **Independent** - One failure doesn't affect others  
✅ **Scalable** - Easy to add more views if needed  

## Troubleshooting

### Workflow Not Activating
- Check that Gemini credentials are set
- Ensure webhook path doesn't conflict with existing workflows

### Getting 404 on Webhook
- Make sure workflow is **Active** (toggle in top right)
- Check the webhook URL in the Webhook node matches your frontend

### Slow Response
- Each Gemini call takes ~12-15 seconds
- With parallel execution, total should be ~15 seconds
- If taking longer, check n8n execution logs

### CORS Errors
- The workflows include CORS headers in the response
- If still getting errors, check browser console for details

## Next Steps

After importing and activating all 4 workflows:

1. ✅ Test each webhook individually with curl
2. ✅ Test from frontend at http://localhost:3001
3. ✅ Monitor n8n execution logs to verify parallel execution
4. ✅ Enjoy 4x faster multi-view generation! 🚀

## Need to Customize?

### Change Prompts
Edit the "prompt" field in each Gemini node to customize output style.

### Add Image Resize
Add an "Edit Image" node before Gemini to resize images and speed up processing:
- Operation: Resize
- Width: 768px (or 512px for even faster)
- Maintain aspect ratio: Yes

### Change Response Format
Currently returns binary PNG. To return base64 JSON instead:
1. Add a Code node after Gemini
2. Convert binary to base64
3. Change Response node to return JSON


