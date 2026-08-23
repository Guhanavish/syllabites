'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/client'
import { inr } from '@/lib/fmt'
import type { MenuItem } from '@/lib/fmt'
import { toast, buzz, openSheet, closeSheet, confirmBox } from '@/lib/ui'

const EMOJIS = ['🍽️', '🍛', '🍜', '🍕', '🍔', '🍟', '🌮', '🥪', '🥟', '🍗', '🥗', '🍚', '🫓', '🥞', '🍩', '🍪', '🍰', '🍦', '🍫', '☕', '🧋', '🥤', '🍿', '🍤', '🍳', '🧆', '🌯', '🥐']

export function MenuTab({ expired }: { expired: (e: any) => boolean }) {
  const [items, setItems] = useState<MenuItem[]>([])
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    try { setItems(await api<MenuItem[]>('/api/items')) } catch (e: any) { expired(e) }
  }, [expired])

  useEffect(() => { load() }, [load])

  const list = items.filter((i) =>
    !q || i.name.toLowerCase().includes(q.toLowerCase()) || i.category.toLowerCase().includes(q.toLowerCase())
  )

  function sheet(item: MenuItem | null) {
    openSheet(
      <ItemForm
        item={item}
        categories={Array.from(new Set(items.map((i) => i.category)))}
        onSaved={() => {
          closeSheet(); buzz(15)
          toast(item ? 'Item updated ✓' : 'Item added to menu ✓', 'ok')
          load()
        }}
      />
    )
  }

  async function toggle(it: MenuItem) {
    try {
      await api('/api/items/save', { method: 'POST', body: { ...it, available: !it.available } })
      setItems(items.map((x) => (x.id === it.id ? { ...x, available: !x.available } : x)))
      toast(!it.available ? `"${it.name}" hidden from menu` : `"${it.name}" is live again`, 'ok')
    } catch (e: any) { if (!expired(e)) toast(e.message, 'bad') }
  }

  async function del(it: MenuItem) {
    const ok = await confirmBox({
      title: `Delete "${it.name}"?`,
      msg: 'Past orders keep their records, but the item disappears from the menu.',
      yes: 'Delete',
    })
    if (!ok) return
    try {
      await api('/api/items/delete', { method: 'POST', body: { id: it.id } })
      toast('Item deleted', 'ok')
      load()
    } catch (e: any) { if (!expired(e)) toast(e.message, 'bad') }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div className="search-wrap" style={{ flex: 1, margin: 0 }}>
          <span className="s-ico">🔎</span>
          <input type="text" placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn-primary" style={{ flex: 'none' }} onClick={() => sheet(null)}>＋ Add</button>
      </div>

      {!list.length ? (
        <div className="empty">
          <span className="e-ico">🍽️</span>
          <h3>No items yet</h3>
          <p>Add your first food item to open the counter.<br />Only you (admin) can add or change items.</p>
          <button className="btn btn-primary" onClick={() => sheet(null)}>＋ Add first item</button>
        </div>
      ) : (
        list.map((it) => (
          <div key={it.id} className="mgmt-row">
            <div className="emoji-tile" style={{ width: 46, height: 46, fontSize: 23 }}>{it.emoji}</div>
            <div className="mgmt-info">
              <div className="mgmt-name">{it.name}</div>
              <div className="mgmt-meta">
                <span>{inr(it.price)}</span>·<span>{it.category}</span>
                <span className={it.stock <= 5 ? (it.stock === 0 ? 'stock-pill sp-zero' : 'stock-pill sp-low') : ''}>
                  {it.stock} in stock
                </span>
                <span className="sold-tag">{it.sold ?? 0} sold</span>
              </div>
            </div>
            <div className="row-actions">
              <button className={`avail-switch${it.available ? ' on' : ''}`} onClick={() => toggle(it)} aria-label="Available" />
              <button className="ra-btn" onClick={() => sheet(it)}>✏️</button>
              <button className="ra-btn" onClick={() => del(it)}>🗑️</button>
            </div>
          </div>
        ))
      )}
    </>
  )
}

function ItemForm({ item, categories, onSaved }: {
  item: MenuItem | null
  categories: string[]
  onSaved: () => void
}) {
  const [emoji, setEmoji] = useState(item?.emoji || '🍽️')
  const [avail, setAvail] = useState(item ? !!item.available : true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr('')
    const payload = {
      id: item?.id,
      emoji,
      available: avail,
      name: String(fd.get('name') || '').trim(),
      category: String(fd.get('category') || '').trim() || 'Snacks',
      price: Number(fd.get('price')),
      stock: Number(fd.get('stock') || 0),
    }
    if (!payload.name) { setErr('Item name is required'); return }
    setBusy(true)
    try {
      await api('/api/items/save', { method: 'POST', body: payload })
      onSaved()
    } catch (ex: any) {
      setErr(ex.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="sheet-head">
        <h2>{item ? 'Edit item' : 'Add new item'}</h2>
        <button className="icon-btn" onClick={() => closeSheet()}>✕</button>
      </div>
      <form className="sheet-body" onSubmit={save} noValidate>
        <div className="field">
          <label>Icon</label>
          <div className="emoji-pick">
            {EMOJIS.map((e) => (
              <button type="button" key={e} className={e === emoji ? 'on' : ''} onClick={() => setEmoji(e)}>{e}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Item name</label>
          <input type="text" name="name" maxLength={60} placeholder="e.g. Veg Sandwich" defaultValue={item?.name || ''} autoFocus />
        </div>
        <div className="field">
          <label>Category</label>
          <input type="text" name="category" maxLength={30} placeholder="e.g. Snacks" defaultValue={item?.category || 'Snacks'} list="catList" />
          <datalist id="catList">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Price (₹)</label>
            <div className="input-prefix">
              <span className="pf">₹</span>
              <input type="number" name="price" min="1" step="0.5" inputMode="decimal" placeholder="49"
                defaultValue={item ? item.price / 100 : ''} />
            </div>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Stock qty</label>
            <input type="number" name="stock" min="0" step="1" inputMode="numeric" placeholder="20"
              defaultValue={item?.stock ?? ''} />
          </div>
        </div>
        <div className="field" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 13, padding: '12px 14px',
        }}>
          <div>
            <b style={{ fontSize: 14 }}>Visible on menu</b><br />
            <small style={{ color: 'var(--muted)', fontWeight: 600 }}>Turn off to hide without deleting</small>
          </div>
          <button type="button" className={`avail-switch${avail ? ' on' : ''}`} onClick={() => setAvail(!avail)} />
        </div>
        {err && <div className="form-error show">{err}</div>}
        <button className={`btn btn-primary xl block${busy ? ' loading' : ''}`} disabled={busy}>
          {item ? 'Save changes' : 'Add to menu'}
        </button>
      </form>
    </>
  )
}
