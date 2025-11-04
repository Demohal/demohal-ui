# Testing Banner URL Feature

## Test Cases

### Test 1: Without banner_url (use_banner_url = false or null)
**Expected behavior:**
- Logo should be visible
- Banner title should be visible
- Card width should be 720px (max-w-[720px])
- Banner height should be normal (not 250px)
- Tabs should be below logo/title section

### Test 2: With banner_url (use_banner_url = true)
**Expected behavior:**
- Logo should NOT be visible
- Banner title should NOT be visible
- Card width should be 1128px (max-w-[1128px])
- Banner height should be 250px
- Banner image should fill the entire banner area
- Tabs should be anchored/stuck to the bottom of the banner card (absolutely positioned)

## Manual Testing Instructions

To test this feature, you need a bot configuration with:
```json
{
  "banner_url": "https://example.com/banner.jpg",
  "use_banner_url": true
}
```

Then navigate to the app with the appropriate bot_id or alias query parameter.

## Code Changes Summary

1. Added `bannerUrl` and `useBannerUrl` state variables
2. Updated `applyBotSettings` to capture these values from bot configuration
3. Modified the banner section to conditionally render:
   - When `useBannerUrl` is true: Shows banner image, hides logo/title
   - When `useBannerUrl` is false/null: Shows logo/title (existing behavior)
4. Adjusted container max-width dynamically based on `useBannerUrl`
5. Positioned tabs at bottom of banner when banner URL is active
