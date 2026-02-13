'use client';

export function Greeting() {
  return (
    <div className="mx-auto mt-8 flex size-full max-w-3xl flex-col justify-center px-4 md:mt-16 md:px-8">
      <div className="font-semibold text-xl md:text-2xl text-foreground">
        Hello there!
      </div>
      <div className="text-xl text-muted-foreground md:text-2xl">
        How can I help you today?
      </div>
    </div>
  );
}
