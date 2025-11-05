# Suggested Followup Questions Feature

## Overview
This feature enhances the bot UI to support suggested followup questions, allowing the bot to recommend a next question and enabling users to accept it by simply typing "Yes".

## Implementation Details

### State Variables Added
```javascript
const [suggestNextQuestion, setSuggestNextQuestion] = useState(false);
const [suggestedQuestion, setSuggestedQuestion] = useState("");
```

### API Response Fields
The feature expects the following fields in the bot response:
- `suggest_next_question` (boolean): Flag to enable suggestion display
- `suggested_question` (string): The actual question text to suggest

Example API response:
```json
{
  "response_text": "Here's the information you requested...",
  "suggest_next_question": true,
  "suggested_question": "Would you like to know more about pricing?"
}
```

### User Experience Flow

1. **Bot Response with Suggestion**: When the bot responds with `suggest_next_question: true`, the UI displays:
   - The normal bot response text
   - A suggestion box below with the message: "A good followup question might be '[suggested question]'. Just type "Yes" in the question box below to ask it."

2. **User Affirmative Response**: When the user types any of these affirmative responses (case-insensitive):
   - yes, yeah, yep, sure, ok, okay, y (English)
   - ja (Dutch, German, Swedish, Norwegian, etc.)
   - si (Spanish, Italian)
   - oui (French)
   - da (Russian, Romanian)
   
   The system **instantly** replaces their input with the suggested question in real-time (WYSIWYG behavior).
   - The replacement happens immediately as the user types, not on send
   - The user sees the suggested question in the input box before pressing Enter
   - This provides clear visual feedback of what will be sent

3. **Suggestion Lifecycle**: 
   - Suggestions are stored when a response is received
   - Suggestions are cleared when a new question is sent
   - Suggestions are cleared if an error occurs

### UI Components

#### Suggestion Display
Located in the response area, after the bot's answer:
```jsx
{suggestNextQuestion && suggestedQuestion && (
  <div className="mt-3 p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--border-default)] text-sm text-[var(--helper-fg)]">
    A good followup question might be '<span className="font-semibold text-[var(--message-fg)]">{suggestedQuestion}</span>'. Just type "Yes" in the question box below to ask it.
  </div>
)}
```

#### Input Interception
Real-time input change handler in `Welcome.jsx` with useEffect for robust replacement:

**useEffect (monitors input and ensures replacement):**
```javascript
// useEffect to ensure affirmative inputs are replaced with suggested question
// This handles edge cases where React batching might cause the replacement to not show
useEffect(() => {
  if (!suggestNextQuestion || !suggestedQuestion || !input) return;
  
  const trimmed = input.trim();
  if (trimmed.length > 0) {
    const lowerInput = trimmed.toLowerCase();
    if (AFFIRMATIVE_KEYWORDS.includes(lowerInput)) {
      // Replace affirmative with suggested question if not already replaced
      if (input !== suggestedQuestion) {
        setInput(suggestedQuestion);
      }
    }
  }
}, [input, suggestNextQuestion, suggestedQuestion]);
```

**handleInputChange (primary replacement logic):**
```javascript
// Handler for input changes with auto-replacement of affirmatives
function handleInputChange(newValue) {
  // Guard clause for null/undefined
  if (newValue === null || newValue === undefined) {
    setInput('');
    return;
  }
  
  // Check if we should auto-replace with suggested question
  if (suggestNextQuestion && suggestedQuestion) {
    const trimmed = newValue.trim();
    if (trimmed.length > 0) {
      const lowerInput = trimmed.toLowerCase();
      if (AFFIRMATIVE_KEYWORDS.includes(lowerInput)) {
        // Auto-replace input with suggested question for WYSIWYG experience
        setInput(suggestedQuestion);
        return;
      }
    }
  }
  // Normal input update
  setInput(newValue);
}
```

**AFFIRMATIVE_KEYWORDS (supports international affirmatives):**
```javascript
// Affirmative keywords that trigger suggested question submission
// Supports English and international affirmatives (e.g., "ja" for Dutch)
const AFFIRMATIVE_KEYWORDS = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'y', 'ja', 'si', 'oui', 'da'];
```

And as a fallback safety in the `doSend()` function:
```javascript
// Note: Input is already replaced if affirmative was typed, but keep this
// as a safety fallback for edge cases or programmatic sends
let finalQuestion = outgoing;
if (suggestNextQuestion && suggestedQuestion) {
  const lowerInput = outgoing.toLowerCase();
  if (AFFIRMATIVE_KEYWORDS.includes(lowerInput)) {
    finalQuestion = suggestedQuestion;
  }
}
```

## Testing

### Manual Testing Steps

1. **Setup**: Configure a bot to return responses with `suggest_next_question: true` and `suggested_question` field

2. **Test Case 1: Suggestion Display**
   - Send a question to the bot
   - Verify the suggestion box appears below the response
   - Verify the suggested question text is displayed correctly
   - Verify the formatting matches the spec

3. **Test Case 2: Real-Time Affirmative Response Replacement**
   - After receiving a suggestion, start typing "yes" (lowercase)
   - **Verify the input box instantly replaces "yes" with the suggested question**
   - **Verify this happens before pressing Enter (WYSIWYG)**
   - Press Enter and verify the suggested question is sent
   - Verify the conversation history shows the suggested question, not "yes"

4. **Test Case 3: Case Insensitivity**
   - Test with: "Yes", "YES", "yeah", "YEAH", "ok", "OK"
   - **Verify all variations are replaced in the input box immediately**
   - Verify all variations result in the suggested question being sent

5. **Test Case 4: Non-Affirmative Responses**
   - After receiving a suggestion, type any other text (e.g., "no", "tell me more")
   - Verify the user's actual input is sent, not the suggestion

6. **Test Case 5: Suggestion Lifecycle**
   - Receive a suggestion
   - Send a non-affirmative response
   - Send another question
   - Verify the suggestion is cleared and doesn't interfere with subsequent questions

7. **Test Case 6: No Suggestion**
   - Send a question that doesn't return a suggestion
   - Verify no suggestion box appears
   - Verify typing "yes" sends "yes" normally

### Expected Behavior

✅ **Correct**:
- Suggestion appears only when both fields are present
- **Affirmative responses are replaced instantly in the input box (real-time/WYSIWYG)**
- **User can see the suggested question before pressing Enter**
- User sees the actual question sent in history
- Suggestions don't persist across conversations

❌ **Incorrect**:
- **User sees "yes" in the input box until they press Enter**
- User sees "yes" in the conversation history
- Suggestions persist after being used
- Non-affirmative responses are intercepted
- Suggestion appears without proper fields

## Code Locations

### Modified Files
- `/src/components/Welcome.jsx`

### Key Functions Modified/Added
1. **handleInputChange()** (New function ~Line 1700-1722)
   - Intercepts input changes in real-time
   - Detects affirmative responses (including international: ja, si, oui, da)
   - Automatically replaces input with suggested question for WYSIWYG experience

2. **useEffect for input monitoring** (New useEffect ~Line 1686-1699)
   - Monitors input state changes
   - Ensures affirmatives are replaced even if React batching delays the update
   - Provides additional safeguard against edge cases

3. **doSend()** (Line ~1724-1753)
   - Keeps fallback affirmative response interception for safety
   - Clears suggestions after sending

3. **Response Handler** (Line ~1842-1860)
   - Captures `suggest_next_question` and `suggested_question` from API
   - Updates suggestion state with sanitization

4. **Response Display UI** (Line ~3066-3072)
   - Displays suggestion box component

5. **AskInputBar Integration** (Line ~3099-3107)
   - Changed from `onChange={setInput}` to `onChange={handleInputChange}`
   - Enables real-time input interception

## Styling

The suggestion box uses existing CSS variables for consistency:
- `bg-[var(--card-bg)]`: Background color
- `border-[var(--border-default)]`: Border color
- `text-[var(--helper-fg)]`: Helper text color
- `text-[var(--message-fg)]`: Main message text color

## Future Enhancements

Potential improvements for future iterations:
1. Allow customization of affirmative keywords per bot
2. Add animation/transition when input text is auto-replaced
3. Support multiple suggested questions
4. Add analytics tracking for suggestion acceptance rate
5. Support for suggestion expiration (e.g., after 1 minute)
6. Add a "Not interested" button to explicitly dismiss suggestions
7. Add visual indicator (e.g., subtle highlight) when input is auto-replaced

## Security Considerations

✅ No new security vulnerabilities introduced:
- Input is properly sanitized through existing flow
- No XSS risks (React handles escaping)
- No injection vulnerabilities
- Suggestion text is treated as display-only until user confirms

## Performance Impact

Minimal performance impact:
- Two new state variables (negligible memory)
- String comparison on send (microseconds)
- Conditional rendering (optimized by React)

## Backward Compatibility

✅ Fully backward compatible:
- Bots without suggestion fields work as before
- No breaking changes to existing functionality
- Feature is opt-in via API response fields
