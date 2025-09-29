import React from 'react';
import './Welcome.css';

const Welcome = () => {
  return (
    <div className="root-container" style={{ color: 'var(--message-fg)' }}>
      <h1>Welcome to the Application</h1>
      <div className="ThemeLabInline" style={{ color: 'var(--message-fg)' }}>
        {/* Additional content */}
      </div>
    </div>
  );
};

export default Welcome;