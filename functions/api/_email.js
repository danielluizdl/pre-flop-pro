export async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY ausente — e-mail ignorado (fail-open)')
    return { ok: false, skipped: true }
  }
  if (!to) return { ok: false, skipped: true }
  const from = env.EMAIL_FROM || 'Pre-Flop Pro <onboarding@resend.dev>'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      console.warn(`Resend retornou ${res.status} — seguindo (best-effort)`)
      return { ok: false }
    }
    return { ok: true }
  } catch (e) {
    console.warn('Falha ao enviar e-mail via Resend — seguindo (best-effort)', String(e))
    return { ok: false }
  }
}
