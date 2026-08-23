## WhatsApp-style Auto-Scroll
- **Problem/Request**: Implement smart auto-scroll behavior in the chat window, preventing jarring jumps when reading older messages and showing a floating unread counter when scrolled up.
- **Files Changed**: `src/components/ChatWindow.tsx`
- **Summary**: Replaced simplistic `setTimeout` scrolling with a `useEffect` engine utilizing `scrollHeight` measurements. Added new refs for pagination anchoring, an unread counter state, and a floating action button (FAB) for unread notifications.
- **Limitations/Edge Cases**: The `isNearBottom` calculation relies on standard DOM heights; if a message contains a very large, slow-loading image that doesn't define its height instantly, it might incorrectly bypass the auto-scroll before the layout stabilizes.

## Temporal Dead Zone Fix
- **Problem/Request**: The newly added auto-scroll `useEffect` referenced `messagesLoaded` before initialization, crashing the application.
- **Files Changed**: `src/components/ChatWindow.tsx`
- **Summary**: Hoisted `messagesLoaded`, `isFetchingOlderRef`, and `messageLimit` state declarations to the top of the component (line 64), guaranteeing they are instantiated before any hooks consume them.
- **Limitations/Edge Cases**: None. Verified via `tsc` that the component successfully typechecks and compiles with no errors.
## Bottom Nav Bar Background Styling
- **Problem/Request**: The bottom navigation bar on mobile had a glassmorphism effect and an inconsistent color (`bg-background/50`) compared to the desktop sidebar (`bg-bg-sidebar`), creating a visual mismatch.
- **Files Changed**: `src/components/IconRail.tsx`
- **Summary**: Removed the `GlassSurface` component wrapper and its `backdrop-blur` effects entirely. Applied a solid, opaque `bg-bg-sidebar` class to the main `div` to ensure exact color consistency with the rest of the application's Telegram theme.
- **Limitations/Edge Cases**: The bottom nav visibility toggle (Issue 1) was not implemented in this step, as requested by the strict scope constraint ("Only touch the bottom navigation bar's background styling").
## Fix IconRail Layout Regression & Mobile Visibility
- **Problem/Request**: Removing the glass effect introduced a layout regression where `flex-1` was accidentally added to the root of `IconRail.tsx`, stretching it across the screen and making the beige empty-state background stand out. Additionally, the bottom nav bar needed to be hidden on mobile when a chat is open.
- **Files Changed**: `src/components/IconRail.tsx`, `src/pages/Dashboard.tsx`
- **Summary**: Removed the `flex-1` class from the `IconRail` root to restore its correct fixed width (64-80px). Corrected the empty state background color in `Dashboard.tsx` from `bg-bg-chat` (beige) to `bg-surface` (gray). Added an `isHiddenOnMobile` prop to `IconRail`, passing it from `Dashboard.tsx` based on `activeConversationId`, which properly hides the bottom nav on mobile when viewing a chat.
- **Limitations/Edge Cases**: None known. Layout behavior should now strictly adhere to standard WhatsApp Web desktop and mobile behavior.
