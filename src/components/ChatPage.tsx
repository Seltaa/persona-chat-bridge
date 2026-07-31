import { FormEvent, useEffect, useRef, useState } from 'react';

type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
};

const TYPE_DELAY_MS = 18;

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function ChatPage() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState<'gpt-5.5' | 'gpt-5.6-sol'>(
    'gpt-5.6-sol',
  );
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(
    () => () =>
      window.personaChat?.setPresentation({
        speaking: false,
        expression: 'neutral',
      }),
    [],
  );

  async function typeReply(
    reply: string,
    expression: PersonaExpression,
  ) {
    const id = nextId.current++;
    setMessages((current) => [
      ...current,
      { id, role: 'assistant', content: '' },
    ]);
    window.personaChat?.setPresentation({ speaking: true, expression });
    for (let index = 1; index <= reply.length; index += 1) {
      setMessages((current) =>
        current.map((message) =>
          message.id === id
            ? { ...message, content: reply.slice(0, index) }
            : message,
        ),
      );
      await wait(TYPE_DELAY_MS);
    }
    window.personaChat?.setPresentation({
      speaking: false,
      expression: 'neutral',
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    const userMessage: ChatMessage = {
      id: nextId.current++,
      role: 'user',
      content,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft('');
    setError('');
    setBusy(true);
    try {
      if (!window.personaChat) throw new Error('Chat bridge unavailable.');
      const result = await window.personaChat.send({
        apiKey,
        model,
        messages: nextMessages.map(({ role, content: messageContent }) => ({
          role,
          content: messageContent,
        })),
      });
      await typeReply(result.reply, result.expression);
    } catch (caught) {
      window.personaChat?.setPresentation({
        speaking: false,
        expression: 'neutral',
      });
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="chat-app">
      <header className="chat-header">
        <div>
          <h1>Fallback Chat</h1>
          <p>Optional chat, motion, and expression test</p>
        </div>
        <select
          aria-label="Model"
          disabled={busy}
          onChange={(event) =>
            setModel(event.target.value as 'gpt-5.5' | 'gpt-5.6-sol')
          }
          value={model}
        >
          <option value="gpt-5.5">GPT-5.5 Thinking</option>
          <option value="gpt-5.6-sol">GPT-5.6 Sol</option>
        </select>
      </header>

      <label className="chat-key">
        <span>OpenAI API key</span>
        <input
          autoComplete="off"
          disabled={busy}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="sk-… (kept only until the app closes)"
          type="password"
          value={apiKey}
        />
      </label>

      <section className="chat-messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <strong>Start a conversation</strong>
            <span>Persona will move and react while replying.</span>
          </div>
        )}
        {messages.map((message) => (
          <article className={`chat-message ${message.role}`} key={message.id}>
            {message.content || '…'}
          </article>
        ))}
        {busy && messages.at(-1)?.role === 'user' && (
          <article className="chat-message assistant">Thinking…</article>
        )}
        <div ref={endRef} />
      </section>

      {error && <p className="chat-error">{error}</p>}

      <form className="chat-composer" onSubmit={submit}>
        <textarea
          aria-label="Message"
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Message Persona"
          rows={2}
          value={draft}
        />
        <button disabled={busy || !draft.trim() || !apiKey.trim()} type="submit">
          {busy ? '…' : 'Send'}
        </button>
      </form>
    </main>
  );
}
