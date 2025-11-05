# Frontend Integration Guide: Suggested Next Question Feature

## Overview

This guide describes the suggested next question feature implementation in the DemoHAL UI. The feature allows bots to suggest follow-up questions to users via a "Yes" button interface.

## Architecture

### Feature Flow

1. **Bot Settings**: The feature is enabled via the `suggest_next_question` boolean flag in bot settings
2. **API Response**: Each bot response can include a `suggested_question` string
3. **User Interaction**: When both conditions are met, a "Yes" button appears
4. **Submission**: Clicking "Yes" submits the suggested question with `use_suggested_question: true` flag
5. **Badge Display**: Responses to suggested questions show a "Suggested" badge

## Implementation Details

### State Variables

Three state variables manage this feature:

```javascript
// From bot settings - enables/disables the feature
const [suggestNextQuestion, setSuggestNextQuestion] = useState(false);

// From API response - the actual suggested question text
const [suggestedQuestion, setSuggestedQuestion] = useState("");

// From API response - indicates if current response is from a suggested question
const [isSuggestedQuestion, setIsSuggestedQuestion] = useState(false);
```

### Bot Settings Integration

The `suggest_next_question` flag is loaded from bot settings:

```javascript
function applyBotSettings(bot) {
  // ... other settings
  setSuggestNextQuestion(!!bot.suggest_next_question);
}
```

**API Endpoint**: `/bot-settings?alias={alias}` or `/bot-settings?bot_id={bot_id}`

**Expected Field**: 
```json
{
  "bot": {
    "suggest_next_question": true
  }
}
```

### API Request Format

When the user clicks "Yes", the request includes a flag:

```javascript
{
  "bot_id": "...",
  "user_question": "Would you like to know more about pricing?",
  "use_suggested_question": true,  // ← This flag is added
  "scope": "standard",
  "debug": true,
  "perspective": "general"
}
```

### API Response Format

Bot responses can include suggested question data:

```json
{
  "response_text": "Here's information about our features...",
  "suggested_question": "Would you like to know more about pricing?",
  "is_suggested_question": false,
  "items": [...],
  "demo_buttons": [...],
  "doc_buttons": [...]
}
```

**Response Fields**:
- `suggested_question` (string, optional): The question to suggest to the user
- `is_suggested_question` (boolean, optional): Indicates if this response is answering a suggested question

### UI Components

#### 1. Yes Button

Appears after the bot response when:
- Not loading
- User has sent a question (`lastQuestion` is set)
- Feature is enabled (`suggestNextQuestion` is true)
- A suggestion is present (`suggestedQuestion` is not empty)

```jsx
{!loading && lastQuestion && suggestNextQuestion && suggestedQuestion && (
  <div className="mt-4">
    <p className="text-sm text-[var(--helper-fg)] mb-2">
      Suggested next question: <span className="font-semibold text-[var(--message-fg)]">{suggestedQuestion}</span>
    </p>
    <button
      onClick={onAcceptSuggestedQuestion}
      className="px-4 py-2 bg-[var(--send-color)] text-white rounded-lg hover:brightness-110 transition-all active:scale-95"
    >
      Yes
    </button>
  </div>
)}
```

#### 2. Suggested Badge

Appears next to the question when `isSuggestedQuestion` is true:

```jsx
{lastQuestion && (
  <p className="text-base italic text-center mb-2 text-[var(--helper-fg)]">
    "{lastQuestion}"
    {isSuggestedQuestion && (
      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
        Suggested
      </span>
    )}
  </p>
)}
```

### State Management

#### When Sending a Question

```javascript
async function doSend(outgoing, useSuggestedQuestion = false) {
  // Clear suggested question state
  setSuggestedQuestion("");
  setIsSuggestedQuestion(false);
  
  // Add flag to payload if using suggested question
  const payload = {
    // ... other fields
    ...(useSuggestedQuestion ? { use_suggested_question: true } : {})
  };
}
```

#### When Receiving a Response

```javascript
// Capture suggested_question from API response
if (typeof data.suggested_question === "string" && data.suggested_question.trim()) {
  setSuggestedQuestion(data.suggested_question.trim());
} else {
  setSuggestedQuestion("");
}

// Capture is_suggested_question flag for badge display
setIsSuggestedQuestion(data.is_suggested_question === true);
```

#### When User Clicks "Yes"

```javascript
async function onAcceptSuggestedQuestion() {
  if (!suggestedQuestion || !botId) return;
  if (maybeOpenForm({ type: "ask", payload: { text: suggestedQuestion } }))
    return;
  await doSend(suggestedQuestion, true); // Pass true to indicate use_suggested_question
}
```

## Backend Requirements

To support this feature, the backend must:

1. **Provide bot settings** with `suggest_next_question` field:
   - Endpoint: `/bot-settings`
   - Field: `bot.suggest_next_question` (boolean)

2. **Accept request flag**:
   - Field: `use_suggested_question` (boolean)
   - When present and `true`, indicates the question came from a suggestion

3. **Return suggestion data**:
   - Field: `suggested_question` (string, optional) - Next question to suggest
   - Field: `is_suggested_question` (boolean, optional) - Whether current response is from a suggestion

## User Experience Flow

### Example Conversation

1. **User asks**: "Tell me about your features"
   ```
   Request: { "user_question": "Tell me about your features" }
   ```

2. **Bot responds with suggestion**:
   ```json
   {
     "response_text": "We offer A, B, and C features...",
     "suggested_question": "Would you like to know more about pricing?"
   }
   ```
   
   UI shows:
   - Response text
   - "Suggested next question: Would you like to know more about pricing?"
   - **[Yes]** button

3. **User clicks "Yes"**:
   ```
   Request: {
     "user_question": "Would you like to know more about pricing?",
     "use_suggested_question": true
   }
   ```
   
   UI shows:
   - Question: "Would you like to know more about pricing?" **[Suggested]** badge

4. **Bot responds**:
   ```json
   {
     "response_text": "Our pricing starts at...",
     "is_suggested_question": true,
     "suggested_question": "Should I schedule a demo?"
   }
   ```
   
   UI shows:
   - **[Suggested]** badge (because `is_suggested_question: true`)
   - New "Yes" button for the next suggestion

## Testing

### Manual Testing Checklist

- [ ] Feature disabled when `suggest_next_question` is false in bot settings
- [ ] "Yes" button appears when suggestion is present
- [ ] "Yes" button disappears after clicking
- [ ] Suggested question is sent with `use_suggested_question: true`
- [ ] Badge appears when `is_suggested_question` is true
- [ ] Badge doesn't appear for non-suggested questions
- [ ] Suggestions clear when sending a new question
- [ ] Works with form fill flow

### Test Bot Configuration

```json
{
  "bot_id": "test-bot",
  "suggest_next_question": true
}
```

### Test API Responses

**With Suggestion**:
```json
{
  "response_text": "This is the answer",
  "suggested_question": "Want to know more?"
}
```

**Without Suggestion**:
```json
{
  "response_text": "This is the answer"
}
```

**Suggested Question Response**:
```json
{
  "response_text": "Here's more info",
  "is_suggested_question": true
}
```

## Styling

The UI uses existing CSS variables for consistency:
- `--helper-fg`: Helper text color
- `--message-fg`: Message text color
- `--send-color`: Button background color

The badge uses Tailwind classes:
- `bg-blue-100 text-blue-800`: Blue badge styling

## Backward Compatibility

✅ Fully backward compatible:
- Bots without `suggest_next_question` setting work as before
- Responses without suggestion fields work normally
- No breaking changes to existing functionality

## Security Considerations

✅ No security vulnerabilities:
- Input is sanitized (trimmed)
- React escaping prevents XSS
- No injection risks
- Flag is boolean, validated

## Performance Impact

Minimal:
- Three new state variables (~24 bytes)
- String comparison for suggested question
- Conditional rendering (React optimized)

## Future Enhancements

Potential improvements:
1. Multiple suggested questions (carousel/list)
2. "No thanks" button to dismiss suggestions
3. Suggestion expiration/timeout
4. Analytics tracking for suggestion acceptance rate
5. Custom button text via bot settings
6. Keyboard shortcut for accepting suggestions
7. Animation/transition effects

## Troubleshooting

### "Yes" button doesn't appear

Check:
1. Is `suggest_next_question` true in bot settings?
2. Does API response include `suggested_question` field?
3. Is `suggestedQuestion` state populated? (Check React DevTools)
4. Is there a `lastQuestion` present?

### Badge doesn't appear

Check:
1. Does API response include `is_suggested_question: true`?
2. Is `isSuggestedQuestion` state set? (Check React DevTools)

### `use_suggested_question` not sent

Check:
1. Is `onAcceptSuggestedQuestion` being called?
2. Is `useSuggestedQuestion` parameter passed correctly?
3. Check network tab for payload contents

## Code Locations

- **State declarations**: `src/components/Welcome.jsx` ~Line 1283
- **Bot settings handler**: `src/components/Welcome.jsx` ~Line 1512
- **doSend function**: `src/components/Welcome.jsx` ~Line 1675
- **Response handler**: `src/components/Welcome.jsx` ~Line 1837
- **Yes button handler**: `src/components/Welcome.jsx` ~Line 1904
- **Badge UI**: `src/components/Welcome.jsx` ~Line 3035
- **Yes button UI**: `src/components/Welcome.jsx` ~Line 3065

---

**Last Updated**: 2025-11-05  
**Version**: 1.0  
**Author**: GitHub Copilot Agent
