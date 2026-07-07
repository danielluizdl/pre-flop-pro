import { useCallback, useEffect, useRef, useState } from 'react'

interface UseAwayGuardOptions {
  awayThresholdMs?: number
  promptTimeoutMs?: number
  onExpire: () => void
}

// Detecta ausência (troca de aba/minimiza) só ao voltar o foco — timers em
// background são throttled pelo browser, então o cálculo usa Date.now() no
// momento do evento em vez de contar ticks. Ausência >= awayThresholdMs abre
// o prompt com deadline absoluta; sem resposta até lá, dispara onExpire().
export function useAwayGuard({ awayThresholdMs = 120_000, promptTimeoutMs = 300_000, onExpire }: UseAwayGuardOptions) {
  const [prompting, setPrompting] = useState(false)
  const [remainingMs, setRemainingMs] = useState(promptTimeoutMs)
  const hiddenAtRef = useRef<number | null>(null)
  const deadlineRef = useRef<number | null>(null)
  const awayMsRef = useRef(0)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  const dismiss = useCallback(() => {
    deadlineRef.current = null
    setPrompting(false)
  }, [])

  const getAwayMs = useCallback(() => awayMsRef.current, [])

  useEffect(() => {
    function markHidden() {
      if (hiddenAtRef.current === null) hiddenAtRef.current = Date.now()
    }
    function checkReturn() {
      const hiddenAt = hiddenAtRef.current
      hiddenAtRef.current = null
      if (hiddenAt === null) return
      const elapsed = Date.now() - hiddenAt
      if (elapsed < awayThresholdMs) return
      awayMsRef.current += elapsed
      deadlineRef.current = Date.now() + promptTimeoutMs
      setRemainingMs(promptTimeoutMs)
      setPrompting(true)
    }
    function onVisibilityChange() {
      if (document.hidden) markHidden()
      else checkReturn()
    }
    window.addEventListener('blur', markHidden)
    window.addEventListener('focus', checkReturn)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('blur', markHidden)
      window.removeEventListener('focus', checkReturn)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [awayThresholdMs, promptTimeoutMs])

  useEffect(() => {
    if (!prompting) return
    function tick() {
      const deadline = deadlineRef.current
      if (deadline === null) return
      const left = deadline - Date.now()
      if (left <= 0) {
        deadlineRef.current = null
        setPrompting(false)
        setRemainingMs(0)
        onExpireRef.current()
      } else {
        setRemainingMs(left)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [prompting])

  return { prompting, remainingMs, dismiss, getAwayMs }
}
