'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Box, Button, Stack, Text, TextInput, PasswordInput, Alert,
} from '@mantine/core';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/gms/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError('Invalid username or password.');
        return;
      }
      // Backend sets auth_token cookie; redirect to gallery.
      router.push('/');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      style={{
        width: '100%',
        maxWidth: 380,
        padding: '40px 32px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
      }}
    >
      <Stack gap="xs" mb={28}>
        <Text size="xs" fw={600} tt="uppercase" lts="0.1em" c="dimmed">
          Gallery AI
        </Text>
        <Text size="xl" fw={700} c="white">
          Sign in
        </Text>
      </Stack>

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {error && (
            <Alert color="red" radius="md" p="sm">
              <Text size="sm">{error}</Text>
            </Alert>
          )}

          <TextInput
            label="Username"
            placeholder="your_username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoComplete="username"
          />

          <PasswordInput
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button type="submit" loading={loading} fullWidth mt={4}>
            Sign in
          </Button>
        </Stack>
      </form>

      <Text size="sm" c="dimmed" mt={24} ta="center">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }}
        >
          Sign up
        </Link>
      </Text>
    </Box>
  );
}
