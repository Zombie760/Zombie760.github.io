'use client';

import { signOut } from 'next-auth/react';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

export function Dashboard({ user }) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Your AI agent is running.
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="outline" onClick={() => signOut()}>
            Sign Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
