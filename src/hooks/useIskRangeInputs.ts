import { useEffect, useRef, useState } from 'react'
import { formatIskInputUnit, parseIskInputUnit } from '@/lib/profit'
import { clampSetupBudget } from '@/lib/ranking'

function inputUnitFromText(raw: string, fallback: 'M' | 'B'): 'M' | 'B' {
  return /[bB]\s*$/.test(raw.trim()) ? 'B' : fallback
}

export interface IskFieldState {
  amount: string
  unit: 'M' | 'B'
  editing: boolean
  setAmount: (value: string) => void
  onFocus: () => void
  onBlur: () => void
}

interface UseIskRangeInputsOptions {
  minIsk: number
  maxIsk: number
  iskMin: number
  iskMax: number
  debounceMs?: number
  onCommit: (minIsk: number, maxIsk: number) => void
}

export function useIskRangeInputs({
  minIsk,
  maxIsk,
  iskMin,
  iskMax,
  debounceMs = 400,
  onCommit,
}: UseIskRangeInputsOptions) {
  const [minText, setMinText] = useState('')
  const [maxText, setMaxText] = useState('')
  const [minUnit, setMinUnit] = useState<'M' | 'B'>('M')
  const [maxUnit, setMaxUnit] = useState<'M' | 'B'>('B')
  const [editingMin, setEditingMin] = useState(false)
  const [editingMax, setEditingMax] = useState(false)
  const minTextRef = useRef(minText)
  const maxTextRef = useRef(maxText)
  const minUnitRef = useRef(minUnit)
  const maxUnitRef = useRef(maxUnit)
  minTextRef.current = minText
  maxTextRef.current = maxText
  minUnitRef.current = minUnit
  maxUnitRef.current = maxUnit

  useEffect(() => {
    if (!editingMin) {
      const { amount, unit } = formatIskInputUnit(minIsk)
      setMinText(amount)
      setMinUnit(unit)
    }
  }, [minIsk, editingMin])

  useEffect(() => {
    if (!editingMax) {
      const { amount, unit } = formatIskInputUnit(maxIsk)
      setMaxText(amount)
      setMaxUnit(unit)
    }
  }, [maxIsk, editingMax])

  function commit(nextMinText: string, nextMaxText: string, force: boolean) {
    const parsedMin = parseIskInputUnit(nextMinText, minUnitRef.current)
    const parsedMax = parseIskInputUnit(nextMaxText, maxUnitRef.current)

    if (parsedMin == null || parsedMax == null) {
      if (force) {
        const minParts = formatIskInputUnit(minIsk)
        const maxParts = formatIskInputUnit(maxIsk)
        setMinText(minParts.amount)
        setMinUnit(minParts.unit)
        setMaxText(maxParts.amount)
        setMaxUnit(maxParts.unit)
      }
      return
    }

    const clampedMin = clampSetupBudget(parsedMin)
    const clampedMax = clampSetupBudget(parsedMax)
    const boundedMin = Math.min(iskMax, Math.max(iskMin, clampedMin))
    const boundedMax = Math.min(iskMax, Math.max(iskMin, clampedMax))
    const nextMin = Math.min(boundedMin, boundedMax)
    const nextMax = Math.max(boundedMin, boundedMax)

    onCommit(nextMin, nextMax)

    const minParts = formatIskInputUnit(nextMin)
    const maxParts = formatIskInputUnit(nextMax)
    setMinText(minParts.amount)
    setMinUnit(minParts.unit)
    setMaxText(maxParts.amount)
    setMaxUnit(maxParts.unit)
  }

  useEffect(() => {
    if (!editingMin && !editingMax) return

    const id = window.setTimeout(() => {
      commit(minText, maxText, false)
    }, debounceMs)

    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce draft text while editing
  }, [minText, maxText, debounceMs, editingMin, editingMax])

  const minField: IskFieldState = {
    amount: minText,
    unit: editingMin ? inputUnitFromText(minText, minUnit) : minUnit,
    editing: editingMin,
    setAmount: (value) => {
      setMinText(value)
      setMinUnit(inputUnitFromText(value, minUnitRef.current))
    },
    onFocus: () => setEditingMin(true),
    onBlur: () => {
      setEditingMin(false)
      commit(minTextRef.current, maxTextRef.current, true)
    },
  }

  const maxField: IskFieldState = {
    amount: maxText,
    unit: editingMax ? inputUnitFromText(maxText, maxUnit) : maxUnit,
    editing: editingMax,
    setAmount: (value) => {
      setMaxText(value)
      setMaxUnit(inputUnitFromText(value, maxUnitRef.current))
    },
    onFocus: () => setEditingMax(true),
    onBlur: () => {
      setEditingMax(false)
      commit(minTextRef.current, maxTextRef.current, true)
    },
  }

  return { minField, maxField }
}
