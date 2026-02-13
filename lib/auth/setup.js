import { getUserCount, createUser } from '../db/users.js';

/**
 * POST handler for /api/auth/setup — creates the first admin user.
 * Returns 403 if any users already exist.
 */
export async function POST(request) {
  try {
    const count = getUserCount();
    if (count > 0) {
      return Response.json(
        { error: 'Setup already completed. An admin account already exists.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return Response.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return Response.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    const user = await createUser(email, password);

    return Response.json({ success: true, user });
  } catch (err) {
    console.error('Setup error:', err);
    return Response.json(
      { error: 'Failed to create admin account.' },
      { status: 500 }
    );
  }
}
