import { useEffect, useRef, useState } from 'react'

export interface NumericFieldState {
  text: string
  editing: boolean
  setText: (value: string) => void
  onFocus: () => void
  onBlur: () => void
}

interface UseNumericSliderInputOptions {
  value: number
  formatDisplay: (value: number) => string
  parseInput: (raw: string) => number | null
  clampValue: (value: number) => number
  onCommit: (value: number) => void
  debounceMs?: number
}

export function useNumericSliderInput({
  value,
  formatDisplay,
  parseInput,
  clampValue,
  onCommit,
  debounceMs = 400,
}: UseNumericSliderInputOptions) {
  const [text, setText] = useState(() => formatDisplay(value))
  const [editing, setEditing] = useState(false)
  const textRef = useRef(text)
  textRef.current = text

  useEffect(() => {
    if (!editing) setText(formatDisplay(value))
  }, [value, editing, formatDisplay])

  function commit(raw: string, force: boolean) {
    const parsed = parseInput(raw)
    if (parsed == null) {
      if (force) setText(formatDisplay(value))
      return
    }

    const next = clampValue(parsed)
    onCommit(next)
    setText(formatDisplay(next))
  }

  useEffect(() => {
    if (!editing) return

    const id = window.setTimeout(() => {
      commit(textRef.current, false)
    }, debounceMs)

    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce draft text while editing
  }, [text, debounceMs, editing])

  const field: NumericFieldState = {
    text,
    editing,
    setText,
    onFocus: () => setEditing(true),
    onBlur: () => {
      setEditing(false)
      commit(textRef.current, true)
    },
  }

  return field
}
