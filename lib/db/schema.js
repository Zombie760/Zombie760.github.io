import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: text('role').notNull().default('admin'),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
});
