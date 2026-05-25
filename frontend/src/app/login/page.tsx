"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, getMe, login } from "@/lib/api";
import { saveSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const token = await login(username, password);
      const user = await getMe(token.access_token);
      saveSession(token.access_token, user);
      router.replace("/operador");
    } catch (caught) {
      const message =
        caught instanceof ApiError ? caught.message : "Nao foi possivel entrar";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="login-title">
        <p className="eyebrow">Acesso</p>
        <h1 id="login-title">
          Login
        </h1>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Usuario
            <input
              autoComplete="username"
              autoFocus
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              required
              type="text"
              value={username}
            />
          </label>
          <label>
            Senha
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="alert error">{error}</p> : null}
          <button className="button primary stretch" disabled={isSubmitting}>
            {isSubmitting ? "Entrando" : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
