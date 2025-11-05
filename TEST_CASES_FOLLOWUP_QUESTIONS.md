# Manual Test Cases for Suggested Followup Questions

## Test Setup

To test this feature, you need to configure your backend API to return responses with the following structure:

```json
{
  "response_text": "Your bot's response text here",
  "suggest_next_question": true,
  "suggested_question": "What would you like to know next?"
}
```

## Test Case 1: Basic Suggestion Display

**Objective**: Verify that suggestions are displayed correctly

**Steps**:
1. Navigate to the app with a valid bot_id or alias
2. Send a question that returns a suggestion
3. Observe the response area

**Expected Result**:
- Bot response text appears normally
- Below the response, a styled box appears with the message:
  "A good followup question might be '[suggested question text]'. Just type "Yes" in the question box below to ask it."
- The suggested question text is bold/highlighted

**Status**: □ Pass  □ Fail

---

## Test Case 2: Affirmative Response - Lowercase "yes"

**Objective**: Verify "yes" is replaced with the suggested question

**Steps**:
1. Receive a bot response with a suggestion
2. Type "yes" (lowercase) in the input box
3. Press Enter or click Send

**Expected Result**:
- The suggested question is sent to the bot (visible in conversation history)
- The word "yes" is NOT visible in the conversation
- Bot processes the suggested question as if user typed it

**Status**: □ Pass  □ Fail

---

## Test Case 3: Affirmative Response - Mixed Case

**Objective**: Verify case-insensitive matching

**Steps**:
1. Receive a bot response with a suggestion
2. Test each variation:
   - "Yes" (capitalized)
   - "YES" (all caps)
   - "Yeah"
   - "yep"
   - "sure"
   - "OK"
   - "okay"
   - "y"

**Expected Result**:
- All variations should trigger the suggested question
- Each should send the suggested question, not the typed affirmative

**Status**: □ Pass  □ Fail

---

## Test Case 4: Non-Affirmative Response

**Objective**: Verify other inputs are not intercepted

**Steps**:
1. Receive a bot response with a suggestion
2. Type "no" or "tell me something else"
3. Press Enter

**Expected Result**:
- The actual typed text is sent (not the suggestion)
- Conversation shows "no" or whatever was typed

**Status**: □ Pass  □ Fail

---

## Test Case 5: Suggestion Persistence

**Objective**: Verify suggestions don't persist incorrectly

**Steps**:
1. Receive a bot response with a suggestion
2. Type a non-affirmative response and send
3. Wait for bot response (without suggestion)
4. Type "yes" and send

**Expected Result**:
- After first question, suggestion should be cleared
- Typing "yes" on the second question should send "yes" normally
- Old suggestion should NOT be reused

**Status**: □ Pass  □ Fail

---

## Test Case 6: No Suggestion

**Objective**: Verify normal operation without suggestions

**Steps**:
1. Send a question that doesn't return a suggestion
2. Verify no suggestion box appears
3. Type "yes" and send

**Expected Result**:
- No suggestion box appears
- "yes" is sent as normal input
- Bot receives "yes" as the question

**Status**: □ Pass  □ Fail

---

## Test Case 7: Error Handling

**Objective**: Verify suggestions are cleared on error

**Steps**:
1. Receive a bot response with a suggestion
2. Simulate or trigger an error (e.g., disconnect network)
3. Reconnect and send a new question

**Expected Result**:
- Error message appears
- Old suggestion is cleared
- Subsequent "yes" responses behave normally

**Status**: □ Pass  □ Fail

---

## Test Case 8: Visual Styling

**Objective**: Verify styling matches design requirements

**Steps**:
1. Receive a bot response with a suggestion
2. Inspect the suggestion box

**Expected Result**:
- Box has proper padding and rounded corners
- Border color matches theme
- Text uses helper foreground color
- Suggested question text is highlighted/bold
- Box is visually distinct but consistent with theme

**Status**: □ Pass  □ Fail

---

## Test Case 9: Multiple Conversations

**Objective**: Verify feature works across multiple question-answer cycles

**Steps**:
1. Ask question #1 → receive suggestion → type "yes" → verify
2. Ask question #2 → receive suggestion → type "no" → verify
3. Ask question #3 → no suggestion → type "yes" → verify

**Expected Result**:
- Each cycle behaves correctly
- No cross-contamination between cycles
- State management is clean

**Status**: □ Pass  □ Fail

---

## Test Case 10: Accessibility

**Objective**: Verify accessibility features

**Steps**:
1. Receive a suggestion
2. Navigate using keyboard only (Tab, Enter)
3. Test with screen reader (if available)

**Expected Result**:
- Text is readable by screen readers
- Keyboard navigation works as expected
- Proper semantic HTML is used

**Status**: □ Pass  □ Fail

---

## Integration Test: Complete Flow

**Objective**: Verify end-to-end flow

**Scenario**:
1. User asks: "Tell me about your pricing"
2. Bot responds with pricing info and suggests: "Would you like to see a demo?"
3. User types: "yes"
4. Bot receives: "Would you like to see a demo?" and responds accordingly
5. Bot response includes new suggestion: "Should I schedule a meeting?"
6. User types: "sure"
7. Bot receives: "Should I schedule a meeting?"

**Expected Result**: 
- Entire conversation flows naturally
- User only types affirmatives but sees suggested questions in history
- Each suggestion is properly cleared and replaced

**Status**: □ Pass  □ Fail

---

## Notes Section

Use this space to record any observations, bugs, or unexpected behavior:

```
Date: _______________
Tester: _______________

Observations:
- 
- 
- 

Issues Found:
- 
- 

Suggestions:
- 
- 
```

---

## Checklist Summary

- [ ] All test cases passed
- [ ] No console errors observed
- [ ] Performance is acceptable
- [ ] UI is consistent with design
- [ ] Feature meets all requirements in problem statement
- [ ] Documentation is complete
