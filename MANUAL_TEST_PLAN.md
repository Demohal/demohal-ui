# Manual Test Plan for Real-Time Affirmative Replacement

## Purpose
Verify that the real-time input replacement feature works correctly for all supported affirmative keywords, including international ones (ja, si, oui, da).

## Prerequisites
- Backend API configured to return `suggest_next_question: true` and a `suggested_question` value
- Browser with developer tools open (to monitor console for errors)
- Test bot with valid bot_id or alias

## Test Environment
- **Browser**: Chrome/Firefox/Safari
- **Device**: Desktop and Mobile (responsive testing)
- **API**: Development or staging environment

---

## Test Case 1: English Affirmatives - Basic

### Objective
Verify English affirmatives trigger instant replacement

### Steps
1. Navigate to app with valid bot
2. Ask a question that returns a suggestion (e.g., "Tell me about pricing")
3. Observe suggestion box appears below bot response
4. Type each affirmative one at a time in the input box:
   - "yes"
   - "Yeah"
   - "YEP"
   - "sure"
   - "ok"
   - "okay"
   - "y"

### Expected Result
- Input box **instantly** shows the suggested question when affirmative is fully typed
- No delay between typing and replacement
- User sees suggested question, NOT the affirmative word
- Pressing Enter sends the suggested question

### Pass Criteria
✅ All English affirmatives trigger instant replacement
✅ Input box updates in real-time (WYSIWYG)
✅ No console errors

---

## Test Case 2: International Affirmatives - Dutch, Spanish, French, Russian

### Objective
Verify international affirmatives work correctly

### Steps
1. Get a bot response with suggestion
2. Type each international affirmative:
   - "ja" (Dutch - lowercase)
   - "Ja" (Dutch - capitalized)
   - "JA" (Dutch - uppercase)
   - "si" (Spanish/Italian)
   - "Si" (Spanish/Italian - capitalized)
   - "oui" (French)
   - "Oui" (French - capitalized)
   - "da" (Russian/Romanian)
   - "Da" (Russian/Romanian - capitalized)

### Expected Result
- Each affirmative instantly replaces input with suggested question
- Case-insensitive matching works correctly
- Replacement happens immediately when word is completed

### Pass Criteria
✅ All international affirmatives trigger replacement
✅ Case variations all work
✅ Input shows suggested question, not affirmative

---

## Test Case 3: Non-Affirmative Text

### Objective
Verify non-affirmative text is NOT replaced

### Steps
1. Get suggestion from bot
2. Type non-affirmative text:
   - "no"
   - "maybe"
   - "tell me more"
   - "yesterday" (contains "yes" but shouldn't match)
   - "okay thanks" (contains "okay" but has extra text)

### Expected Result
- Input box shows exactly what user typed
- NO replacement occurs
- User can send their actual input

### Pass Criteria
✅ Non-affirmatives are NOT replaced
✅ Partial matches don't trigger replacement
✅ User's actual text is preserved

---

## Test Case 4: Whitespace Handling

### Objective
Verify trimming works correctly

### Steps
1. Get suggestion
2. Type affirmatives with whitespace:
   - " yes " (spaces before and after)
   - "  ja  " (multiple spaces)
   - "yes\n" (with newline)

### Expected Result
- Whitespace is trimmed
- Affirmative is detected
- Input is replaced with suggested question

### Pass Criteria
✅ Leading/trailing whitespace doesn't prevent detection
✅ Replacement still occurs

---

## Test Case 5: Rapid Typing / React Batching

### Objective
Verify useEffect catches cases where handleInputChange might miss due to batching

### Steps
1. Get suggestion
2. Type "yes" very quickly (rapid keystrokes)
3. Observe input box immediately after typing

### Expected Result
- Input box shows suggested question (not "yes")
- Replacement happens even with rapid typing
- No "flickering" between affirmative and suggestion

### Pass Criteria
✅ Rapid typing doesn't break replacement
✅ useEffect catches any missed cases
✅ Final state is always suggested question

---

## Test Case 6: Suggestion Lifecycle

### Objective
Verify suggestions are cleared properly

### Steps
1. Get suggestion (e.g., "Tell me about pricing")
2. Type "yes" - verify replacement
3. Press Enter to send
4. Wait for bot response (without suggestion)
5. Type "yes" again

### Expected Result
- First "yes" is replaced with suggestion
- After sending, suggestion is cleared
- Second "yes" is sent as normal text (not replaced)

### Pass Criteria
✅ Suggestions cleared after sending
✅ Old suggestions don't persist
✅ "yes" behaves normally when no suggestion active

---

## Test Case 7: No Suggestion Active

### Objective
Verify normal behavior when no suggestion present

### Steps
1. Ask question that doesn't return suggestion
2. Type "yes", "ja", etc.
3. Press Enter

### Expected Result
- Input shows exactly what user typed
- No replacement occurs
- Affirmative is sent as normal question

### Pass Criteria
✅ Affirmatives work normally without suggestion
✅ No errors in console
✅ Feature doesn't interfere with normal operation

---

## Test Case 8: Error Handling

### Objective
Verify suggestions cleared on error

### Steps
1. Get suggestion
2. Disconnect network (or cause API error)
3. Type "yes" and send
4. Reconnect and ask new question
5. Type "yes"

### Expected Result
- Error message displayed
- Suggestion cleared after error
- Second "yes" doesn't use old suggestion

### Pass Criteria
✅ Errors don't cause stale suggestions
✅ Feature recovers gracefully

---

## Test Case 9: Mobile/Touch Devices

### Objective
Verify feature works on mobile

### Steps
1. Test on actual mobile device or browser emulation
2. Get suggestion
3. Type affirmatives using touch keyboard

### Expected Result
- Same behavior as desktop
- Input replacement works correctly
- No touch-specific issues

### Pass Criteria
✅ Works on mobile devices
✅ Touch keyboard doesn't cause issues

---

## Test Case 10: Visual Verification

### Objective
Verify suggestion box styling and visibility

### Steps
1. Get bot response with suggestion
2. Observe suggestion box

### Expected Result
- Suggestion box clearly visible
- Proper padding, border, colors
- Suggested question text is bold/highlighted
- Helper text is readable
- Box doesn't overlap other content

### Pass Criteria
✅ Styling matches design
✅ Text is readable
✅ Layout is clean

---

## Integration Test: Complete User Flow

### Scenario
User has a conversation using suggested followup questions

### Steps
1. User asks: "Tell me about your product"
2. Bot responds with suggestion: "Would you like to see a demo?"
3. User types: "yes"
   - **Verify**: Input shows "Would you like to see a demo?"
4. User presses Enter
   - **Verify**: Question is sent
5. Bot responds with suggestion: "Should I schedule a meeting?"
6. User types: "ja" (Dutch)
   - **Verify**: Input shows "Should I schedule a meeting?"
7. User presses Enter
8. Bot responds WITHOUT suggestion
9. User types: "yes"
   - **Verify**: Input shows "yes" (not replaced)

### Pass Criteria
✅ Entire flow works smoothly
✅ Each replacement is instant
✅ Conversation history shows suggested questions
✅ Feature doesn't interfere when no suggestion

---

## Performance Testing

### Objective
Verify no performance degradation

### Steps
1. Have multiple suggestions in a conversation
2. Monitor browser performance
3. Check for memory leaks
4. Verify smooth scrolling and typing

### Expected Result
- No lag when typing
- No memory leaks
- Smooth user experience
- Console shows no warnings

### Pass Criteria
✅ No performance issues
✅ No memory leaks
✅ Smooth experience

---

## Accessibility Testing

### Objective
Verify feature is accessible

### Steps
1. Test with keyboard only (Tab, Enter)
2. Test with screen reader (if available)
3. Verify proper ARIA labels

### Expected Result
- Keyboard navigation works
- Screen reader announces suggestion
- All interactive elements accessible

### Pass Criteria
✅ Keyboard accessible
✅ Screen reader compatible

---

## Bug Checklist

During testing, watch for:
- [ ] Input box doesn't update (shows affirmative instead of suggestion)
- [ ] Suggestion persists after it should be cleared
- [ ] Non-affirmatives get replaced incorrectly
- [ ] Console errors or warnings
- [ ] Performance issues
- [ ] Layout/styling issues
- [ ] Mobile-specific problems
- [ ] Accessibility issues

---

## Sign-Off

**Tester Name**: _______________
**Date**: _______________
**Environment**: _______________

### Test Results Summary
- Total Test Cases: 10 core + 1 integration + 2 additional
- Passed: _____ / _____
- Failed: _____ / _____
- Blocked: _____ / _____

### Issues Found
1. _______________________
2. _______________________
3. _______________________

### Recommendations
_______________________
_______________________

### Approval
- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for production

**Approved By**: _______________
**Date**: _______________
