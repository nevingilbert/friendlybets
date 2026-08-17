import { useState } from 'react'
import { Button, Modal } from './ui'
import { QrCode } from './QrCode'
import { inviteUrlFor } from '../lib/invite'

/**
 * Three ways in, because a party has all three situations: someone across the
 * room (QR), someone in the group chat (link), someone on the phone (code).
 */
export function ShareLobbyModal({ lobby, onClose }) {
  const url = inviteUrlFor(lobby.code)
  const [copied, setCopied] = useState('')

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      // Clipboard is blocked outside a secure context; the text is on screen
      // anyway, so just prompt a manual copy rather than failing silently.
      setCopied('Copy blocked — select the text above')
      setTimeout(() => setCopied(''), 3000)
    }
  }

  const share = async () => {
    const payload = {
      title: 'FriendlyBets',
      text: `Join my betting lobby "${lobby.name}"`,
      url,
    }
    try {
      if (navigator.share) {
        await navigator.share(payload)
        return
      }
    } catch {
      // User dismissed the share sheet — fall through to copying.
    }
    copy(url, 'Link copied')
  }

  return (
    <Modal title="Invite your friends" onClose={onClose}>
      <div className="flex flex-col items-center gap-5">
        <QrCode value={url} size={190} className="p-3" />

        <div className="w-full text-center">
          <p className="text-xs tracking-widest text-zinc-500 uppercase">Join code</p>
          <p className="font-mono text-4xl font-bold tracking-[0.35em] text-emerald-300">
            {lobby.code}
          </p>
        </div>

        <p className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-center font-mono text-xs break-all text-zinc-400 select-all">
          {url}
        </p>

        <div className="grid w-full grid-cols-2 gap-3">
          <Button onClick={share}>Share link</Button>
          <Button variant="secondary" onClick={() => copy(url, 'Link copied')}>
            Copy link
          </Button>
        </div>

        <p className="min-h-5 text-xs text-emerald-400">{copied}</p>
      </div>
    </Modal>
  )
}
