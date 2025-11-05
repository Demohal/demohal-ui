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
   - yes
   - yeah
   - yep
   - sure
   - ok
   - okay
   - y
   
   The system automatically replaces their input with the suggested question before sending.

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
In the `sendMessage()` function:
```javascript
// Intercept affirmative responses and replace with suggested question
if (suggestNextQuestion && suggestedQuestion) {
  const affirmatives = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'y'];
  if (affirmatives.includes(outgoing.toLowerCase())) {
    outgoing = suggestedQuestion;
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

3. **Test Case 2: Affirmative Response Interception**
   - After receiving a suggestion, type "yes" (lowercase)
   - Verify the suggested question is sent instead
   - Verify the conversation history shows the suggested question, not "yes"

4. **Test Case 3: Case Insensitivity**
   - Test with: "Yes", "YES", "yeah", "YEAH", "ok", "OK"
   - Verify all variations are intercepted correctly

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
- Affirmative responses are replaced seamlessly
- User sees the actual question sent in history
- Suggestions don't persist across conversations

❌ **Incorrect**:
- User sees "yes" in the conversation history
- Suggestions persist after being used
- Non-affirmative responses are intercepted
- Suggestion appears without proper fields

## Code Locations

### Modified Files
- `/src/components/AskAssistant.jsx`

### Key Functions Modified
1. **sendMessage()** (Line ~1189-1306)
   - Added affirmative response interception
   - Added suggestion clearing

2. **Response Handler** (Line ~1275-1304)
   - Added capture of `suggest_next_question` and `suggested_question`
   - Added suggestion state updates

3. **Response Display UI** (Line ~1750-1770)
   - Added suggestion box component

## Styling

The suggestion box uses existing CSS variables for consistency:
- `bg-[var(--card-bg)]`: Background color
- `border-[var(--border-default)]`: Border color
- `text-[var(--helper-fg)]`: Helper text color
- `text-[var(--message-fg)]`: Main message text color

## Future Enhancements

Potential improvements for future iterations:
1. Allow customization of affirmative keywords per bot
2. Add animation when suggestion appears
3. Support multiple suggested questions
4. Add analytics tracking for suggestion acceptance rate
5. Support for suggestion expiration (e.g., after 1 minute)
6. Add a "Not interested" button to explicitly dismiss suggestions

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
