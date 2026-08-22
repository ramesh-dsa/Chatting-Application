const fs = require('fs');

let chatWindow = fs.readFileSync('src/components/ChatWindow.tsx', 'utf8');

chatWindow = chatWindow.replace(
  `isLastMessage={index === messages.length - 1}`,
  ``
);

chatWindow = chatWindow.replace(
  `onInfo={(msg) => setInfoMessageId(msg.id)}`,
  ``
);
chatWindow = chatWindow.replace(
  `onInfo={(msg) => setInfoMessageId(msg.id)}`,
  ``
);

fs.writeFileSync('src/components/ChatWindow.tsx', chatWindow);

let messageBubble = fs.readFileSync('src/components/MessageBubble.tsx', 'utf8');

if (!messageBubble.includes('useRef')) {
  messageBubble = messageBubble.replace(
    `import React from 'react';`,
    `import React, { useEffect, useRef } from 'react';`
  );
}

fs.writeFileSync('src/components/MessageBubble.tsx', messageBubble);

