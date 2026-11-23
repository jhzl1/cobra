/** The photo of a transfer receipt as it arrives in the chat: a light phone screenshot. */
export const ReceiptThumbnail = () => (
  <div className="grid w-47 gap-1 rounded-md bg-[#f2f2f2] p-3 text-[11px] text-[#1a1a1a]">
    <div className="flex items-center gap-1.5 text-xs font-semibold">
      <span className="size-3.5 rounded-sm bg-[#3a0d5c]" />
      Nequi · Envío exitoso
    </div>
    <div className="font-mono text-xl font-semibold tracking-tight">$ 75.000</div>
    <div className="flex justify-between font-mono text-[#555]">
      <span>Referencia</span>
      <span>M8841207</span>
    </div>
    <div className="flex justify-between font-mono text-[#555]">
      <span>Fecha</span>
      <span>22/11 10:38</span>
    </div>
  </div>
)
