/** Shown beside live regional market quotes (ESI / Fuzzwork orders). */
export const LIVE_QUOTE_NPC_ONLY_NOTE =
  'Live sell and buy quotes use the public regional order book: NPC station sell orders only. Sell listings in player structures (citadels) are not included. Ranged buy orders from structures may appear. Market history below uses completed trades and includes structure activity.'

export function ItemLiveQuoteNotice() {
  return (
    <div className="mb-3 rounded-lg border border-primary/40 bg-primary px-3 py-2.5 text-sm leading-snug text-primary-content">
      <span>{LIVE_QUOTE_NPC_ONLY_NOTE}</span>
    </div>
  )
}
