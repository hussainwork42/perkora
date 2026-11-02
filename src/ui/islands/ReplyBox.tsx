import { useState } from 'react';
import { LuMail, LuMessageCircle, LuReply, LuSend } from 'react-icons/lu';

/**
 * Reply to a website message from the admin. With email set up, the reply is sent from
 * Perkora. Without it, the reply opens in the admin's email app or WhatsApp, already written,
 * and is logged in the thread.
 */
export default function ReplyBox({ sendUrl, logUrl, csrf, email, phone, firstName, mailReady }: {
  sendUrl: string;
  logUrl: string;
  csrf: string;
  email: string;
  phone: string;
  firstName: string;
  mailReady: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(`Hi ${firstName},\n\n\n\nBest regards,\nPerkora`);
  const subject = 'Re: your message to Perkora';
  const log = (channel: 'email_app' | 'whatsapp') => {
    try {
      fetch(logUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ body: text, channel }),
        keepalive: true,
      });
    } catch {
      /* logging is best-effort */
    }
  };
  if (!open) {
    return (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
        <LuReply className="h-4 w-4" aria-hidden="true" /> Reply
      </button>
    );
  }
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  const wa = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : '';
  return (
    <form method="post" action={sendUrl} className="mt-1 grid w-full gap-2.5">
      <input type="hidden" name="_csrf" value={csrf} />
      <label className="sr-only" htmlFor={`reply-${logUrl}`}>
        Your reply
      </label>
      <textarea
        id={`reply-${logUrl}`}
        name="body"
        rows={6}
        maxLength={5000}
        required
        value={text}
        onChange={(e: any) => setText((e.currentTarget as HTMLTextAreaElement).value)}
        className="textarea"
        autoFocus
      />
      <div className="flex flex-wrap items-center gap-2">
        {mailReady ? (
          <button type="submit" className="btn btn-primary btn-sm">
            <LuSend className="h-4 w-4" aria-hidden="true" /> Send to {email}
          </button>
        ) : (
          <a href={mailto} className="btn btn-primary btn-sm" onClick={() => log('email_app')}>
            <LuMail className="h-4 w-4" aria-hidden="true" /> Open in my email app
          </a>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" onClick={() => log('whatsapp')}>
            <LuMessageCircle className="h-4 w-4" aria-hidden="true" /> Send on WhatsApp
          </a>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {!mailReady && <p className="text-[12.5px] text-muted-ink">Email sending isn’t set up yet, so your reply opens in your own email app, already written.</p>}
    </form>
  );
}
