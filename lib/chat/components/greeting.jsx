'use client';

export function Greeting({ codeMode = false }) {
  return (
    <div className="w-full text-center">
      <div className="font-semibold text-2xl md:text-3xl text-foreground">
        {codeMode ? 'How can I help you code today?' : 'Hello! How can I help?'}
      </div>
      {codeMode && (
        <div className="mt-2 text-sm text-muted-foreground">
          Discuss your project and let me know when you're ready to start coding.
        </div>
      )}
    </div>
  );
}
