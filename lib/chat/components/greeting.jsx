'use client';

export function Greeting() {
  return (
    <div className="w-full">
      <div className="font-semibold text-xl md:text-2xl text-foreground">
        Hello there!
      </div>
      <div className="text-xl text-muted-foreground md:text-2xl">
        How can I help you today?
      </div>
    </div>
  );
}
