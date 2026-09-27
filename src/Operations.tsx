import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import type { FormEvent, MouseEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowRight, ChevronDown, ChevronUp, CirclePlus, ClipboardList, PackagePlus, Pencil, Plus, Printer, RefreshCw, Search, ShoppingBasket, Trash2 } from 'lucide-react'
import { authenticatedRequest } from './api-client'
import type { Identity } from './session'
import './operations.css'

type Membership = Identity['memberships'][number]
type Register = { id: string; code: string; name: string }
type Store = { id: string; code: string; name: string; registers: Register[] }
type Context = { organization: string; currency: string; stores: Store[] }
type Preset = { name: string; quantity: number; price_minor: number }
type Product = { id: string; name: string; sku: string; barcode: string | null; category: string | null; stock_unit: 'piece' | 'gram'; presets: Preset[]; price_minor: number; cost_minor: number; quantity: number; low_stock_threshold: number; low_stock: boolean; active: boolean }
type Customer = { id: string; name: string; phone: string | null }
type ReceiptLine = { id: string; product_id: string; name: string; sku: string; quantity: number; stock_quantity: number; unit_label: string; unit_price_minor: number; line_total_minor: number }
type Receipt = { id: string; receipt_number: string; created: string; organization: string; store: string; store_address: string; receipt_footer: string; currency: string; customer_type: 'walkin' | 'daily'; customer_id: string | null; customer: string | null; total_minor: number; cash_received_minor: number; change_minor: number; lines: ReceiptLine[] }
type EditableLine = ReceiptLine & { preset_index?: number; grams?: number; added?: boolean }
type SaleSummary = { id: string; receipt_number: string; created: string; total_minor: number; customer_type: string }
type Report = { date: string; timezone: string; currency: string; sale_count: number; units_sold: number; gross_sales_minor: number; cash_collected_minor: number; estimated_cost_minor: number; estimated_gross_profit_minor: number; low_stock: { product_id: string; name: string; sku: string; quantity: number; stock_unit: 'piece' | 'gram'; threshold: number }[]; sales: SaleSummary[] }
type Movement = { id: string; product_name: string; stock_unit: 'piece' | 'gram'; kind: string; delta: number; created: string; note: string }
type Scope = { membership: Membership; context: Context; store: Store }

async function operationsRequest<T>(organizationId: string, path: string, method = 'GET', body?: object): Promise<T> {
  const response = await authenticatedRequest(`/api/v1/organizations/${organizationId}/operations/${path}`, method, body)
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { detail?: string }
    throw new Error(typeof data.detail === 'string' ? data.detail : 'The operation could not be completed.')
  }
  return response.json() as Promise<T>
}

function money(minor: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(minor / 100)
}

function minor(value: string) { return Math.round(Number(value || '0') * 100) }
function stockAmount(quantity: number, unit: 'piece' | 'gram') { return unit === 'gram' ? `${new Intl.NumberFormat('en', { maximumFractionDigits: 3 }).format(quantity / 1000)} kg` : `${quantity} ${quantity === 1 ? 'item' : 'items'}` }
function errorText(reason: unknown) { return reason instanceof Error ? reason.message : 'Please try again.' }
function deletePopoverPosition(item: Product, button: HTMLButtonElement) {
  const rect = button.getBoundingClientRect()
  const width = Math.min(340, window.innerWidth - 24)
  const estimatedHeight = item.quantity > 0 ? 255 : 195
  const top = rect.bottom + 8 + estimatedHeight <= window.innerHeight
    ? rect.bottom + 8 : Math.max(12, rect.top - estimatedHeight - 8)
  const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))
  return { top, left }
}

function Workspace({ memberships, permission, title, description, children }: { memberships: Membership[]; permission: string; title: string; description: string; children: (scope: Scope) => ReactNode }) {
  const eligible = memberships.filter(member => member.permissions.includes(permission))
  const [organizationId, setOrganizationId] = useState('')
  const [storeId, setStoreId] = useState('')
  const membership = eligible.find(member => member.organization_id === organizationId) || eligible[0]
  const context = useQuery<Context>({ queryKey: ['operations-context', membership?.organization_id], queryFn: () => operationsRequest<Context>(membership.organization_id, 'context'), enabled: !!membership, retry: false })
  const store = context.data?.stores.find(row => row.id === storeId) || context.data?.stores[0]
  return <section className="retail-workspace">
    <div className="retail-heading"><div><p className="eyebrow">STORE WORKSPACE</p><h1>{title}</h1><p>{description}</p></div>
      <div className="retail-scope">
        {eligible.length > 1 && <label>Organization<select value={membership?.organization_id || ''} onChange={event => { setOrganizationId(event.target.value); setStoreId('') }}>{eligible.map(member => <option key={member.organization_id} value={member.organization_id}>{member.name}</option>)}</select></label>}
        {!!context.data?.stores.length && <label>Store<select value={store?.id || ''} onChange={event => setStoreId(event.target.value)}>{context.data.stores.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
      </div>
    </div>
    {!membership && <div className="panel retail-empty">You do not have access to this workspace. Ask an administrator to grant the appropriate permission.</div>}
    {membership && context.isPending && <div className="panel retail-empty" role="status">Loading your stores…</div>}
    {context.isError && <div className="panel retail-empty" role="alert">{errorText(context.error)}</div>}
    {context.data && !store && <div className="panel retail-empty">No active store is assigned to you. Set up a store and register first.</div>}
    {membership && context.data && store && children({ membership, context: context.data, store })}
  </section>
}

export function Terminal({ memberships }: { memberships: Membership[] }) {
  return <Workspace memberships={memberships} permission="sales.create" title="Terminal" description="Search items, build a cart, and finish a cash sale.">{scope => <TerminalDesk key={`${scope.membership.organization_id}-${scope.store.id}`} scope={scope} />}</Workspace>
}

function TerminalDesk({ scope }: { scope: Scope }) {
  const { membership, context, store } = scope
  const orgId = membership.organization_id
  const cache = useQueryClient()
  const [registerId, setRegisterId] = useState(store.registers[0]?.id || '')
  const [search, setSearch] = useState('')
  const term = useDeferredValue(search)
  const [billSearch, setBillSearch] = useState('')
  const billTerm = useDeferredValue(billSearch)
  const [cart, setCart] = useState<Record<string, { product: Product; quantity: number; stockQuantity: number; priceMinor: number; label: string; presetIndex?: number; grams?: number }>>({})
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [customerType, setCustomerType] = useState<'walkin' | 'daily'>('walkin')
  const [customerId, setCustomerId] = useState('')
  const [newCustomer, setNewCustomer] = useState(false)
  const [cash, setCash] = useState('')
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID())
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [editing, setEditing] = useState(false)
  const [editLines, setEditLines] = useState<EditableLine[]>([])
  const [editCustomerType, setEditCustomerType] = useState<'walkin' | 'daily'>('walkin')
  const [editCustomerId, setEditCustomerId] = useState('')
  const [editCash, setEditCash] = useState('')
  const [editSearch, setEditSearch] = useState('')
  const [editProductId, setEditProductId] = useState('')
  const [editChoice, setEditChoice] = useState('base')
  const [editGrams, setEditGrams] = useState('')
  const [editError, setEditError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const products = useQuery<Product[]>({ queryKey: ['terminal-products', orgId, store.id, term], queryFn: () => operationsRequest<Product[]>(orgId, `stores/${store.id}/products?query=${encodeURIComponent(term)}`), retry: false })
  const customers = useQuery<Customer[]>({ queryKey: ['terminal-customers', orgId], queryFn: () => operationsRequest<Customer[]>(orgId, 'customers'), retry: false })
  const sales = useQuery<SaleSummary[]>({ queryKey: ['terminal-sales', orgId, store.id, billTerm], queryFn: () => operationsRequest<SaleSummary[]>(orgId, `stores/${store.id}/sales?query=${encodeURIComponent(billTerm)}`), retry: false })
  const editProducts = useQuery<Product[]>({ queryKey: ['terminal-products', orgId, store.id, editSearch], queryFn: () => operationsRequest<Product[]>(orgId, `stores/${store.id}/products?query=${encodeURIComponent(editSearch)}`), enabled: editing, retry: false })
  const items = (products.data || []).filter(product => product.active)
  const cartItems = Object.values(cart)
  const total = cartItems.reduce((sum, line) => sum + line.priceMinor * line.quantity, 0)
  const tendered = minor(cash)
  const editTotal = editLines.reduce((sum, line) => sum + line.unit_price_minor * line.quantity, 0)
  const editProduct = editProducts.data?.find(product => product.id === editProductId)

  function usedStock(id: string) { return Object.values(cart).filter(line => line.product.id === id).reduce((sum, line) => sum + line.stockQuantity * line.quantity, 0) }
  function add(product: Product) {
    const choice = choices[product.id] || 'base'
    const presetIndex = choice.startsWith('preset:') ? Number(choice.slice(7)) : undefined
    const preset = presetIndex === undefined ? undefined : product.presets[presetIndex]
    const grams = choice === 'grams' ? Number(weights[product.id]) : undefined
    const stockQuantity = preset ? preset.quantity : choice === 'grams' ? grams! : (product.stock_unit === 'gram' ? 1000 : 1)
    if (!Number.isInteger(stockQuantity) || stockQuantity < 1 || (choice === 'grams' && stockQuantity > 1000000)) { setError('Enter a valid whole number of grams.'); return }
    if (usedStock(product.id) + stockQuantity > product.quantity) { setError(`Not enough stock for ${product.name}.`); return }
    const key = `${product.id}:${choice}${grams ? `:${grams}` : ''}`
    const priceMinor = preset ? preset.price_minor : grams ? Math.round(product.price_minor * grams / 1000) : product.price_minor
    const label = preset?.name || (grams ? `${grams} g` : product.stock_unit === 'gram' ? 'kg' : 'each')
    setCart(current => ({ ...current, [key]: { product, quantity: (current[key]?.quantity || 0) + 1, stockQuantity, priceMinor, label, presetIndex, grams } }))
    setError('')
  }
  function quantity(key: string, value: number) { setCart(current => { const next = { ...current }; if (value <= 0) delete next[key]; else next[key] = { ...next[key], quantity: value }; return next }) }
  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const values = new FormData(event.currentTarget)
    try {
      const customer = await operationsRequest<Customer>(orgId, 'customers', 'POST', { name: String(values.get('name') || ''), phone: String(values.get('phone') || '') || null })
      await cache.invalidateQueries({ queryKey: ['terminal-customers', orgId] })
      setCustomerId(customer.id); setNewCustomer(false)
    } catch (reason) { setError(errorText(reason)) } finally { setBusy(false) }
  }
  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const result = await operationsRequest<Receipt>(orgId, `stores/${store.id}/checkout`, 'POST', {
        client_key: clientKey, register_id: registerId, customer_type: customerType,
        customer_id: customerType === 'daily' ? customerId : null,
        lines: cartItems.map(line => ({ product_id: line.product.id, quantity: line.quantity, preset_index: line.presetIndex ?? null, grams: line.grams ?? null })),
        cash_received_minor: tendered,
      })
      setReceipt(result); setCart({}); setCash(''); setClientKey(crypto.randomUUID())
      setMessage(`${result.receipt_number} completed. Bill is ready to print.`)
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['terminal-products', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['terminal-sales', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['operations-stock', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['operations-report', orgId, store.id] }),
      ])
    } catch (reason) { setError(errorText(reason)) } finally { setBusy(false) }
  }
  async function openReceipt(id: string) {
    setError('')
    try { setReceipt(await operationsRequest<Receipt>(orgId, `stores/${store.id}/sales/${id}`)) }
    catch (reason) { setError(errorText(reason)) }
  }
  function beginEdit() {
    if (!receipt) return
    setEditLines(receipt.lines.map(line => ({ ...line })))
    setEditCustomerType(receipt.customer_type)
    setEditCustomerId(receipt.customer_id || '')
    setEditCash((receipt.cash_received_minor / 100).toFixed(2))
    setEditSearch('')
    setEditProductId('')
    setEditChoice('base')
    setEditGrams('')
    setEditError('')
    setEditing(true)
  }
  function addEditLine() {
    if (!editProduct) return
    const presetIndex = editChoice.startsWith('preset:') ? Number(editChoice.slice(7)) : undefined
    const preset = presetIndex === undefined ? undefined : editProduct.presets[presetIndex]
    const grams = editChoice === 'grams' ? Number(editGrams) : undefined
    const stockQuantity = preset?.quantity ?? (grams || (editProduct.stock_unit === 'gram' ? 1000 : 1))
    if (!Number.isInteger(stockQuantity) || stockQuantity < 1 || stockQuantity > 1000000 || (editChoice === 'grams' && !grams)) { setEditError('Enter a valid weight.'); return }
    const price = preset?.price_minor ?? (grams ? Math.round(editProduct.price_minor * grams / 1000) : editProduct.price_minor)
    setEditLines(current => [...current, { id: crypto.randomUUID(), product_id: editProduct.id, name: editProduct.name, sku: editProduct.sku, quantity: 1, stock_quantity: stockQuantity, unit_label: preset?.name || (grams ? `${grams} g` : editProduct.stock_unit === 'gram' ? 'kg' : 'each'), unit_price_minor: price, line_total_minor: price, preset_index: presetIndex, grams, added: true }])
    setEditError('')
  }
  async function saveBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!receipt) return
    setBusy(true); setEditError('')
    try {
      const updated = await operationsRequest<Receipt>(orgId, `stores/${store.id}/sales/${receipt.id}`, 'PUT', {
        customer_type: editCustomerType, customer_id: editCustomerType === 'daily' ? editCustomerId : null,
        cash_received_minor: minor(editCash),
        lines: editLines.map(line => ({ line_id: line.added ? null : line.id, product_id: line.product_id, quantity: line.quantity, unit_price_minor: line.unit_price_minor, preset_index: line.preset_index ?? null, grams: line.grams ?? null })),
      })
      setReceipt(updated); setEditing(false)
      setMessage(`${updated.receipt_number} updated.`)
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['terminal-products', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['terminal-sales', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['operations-stock', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['operations-report', orgId, store.id] }),
      ])
    } catch (reason) { setEditError(errorText(reason)) } finally { setBusy(false) }
  }
  return <>
    <div className="terminal-layout">
      <section className="panel terminal-catalog"><div className="retail-panel-title"><div><h2>Find an item</h2><p>Search by name, SKU, or barcode.</p></div><Search size={20} aria-hidden="true" /></div>
        <label className="retail-search"><Search size={17} aria-hidden="true" /><input autoFocus aria-label="Search products" placeholder="Search items or scan a barcode" value={search} onChange={event => setSearch(event.target.value)} /></label>
        {products.isPending && <p className="retail-helper" role="status">Loading products…</p>}
        {products.isError && <p className="retail-error" role="alert">{errorText(products.error)}</p>}
        {!products.isPending && !items.length && <div className="retail-empty">No items found. Add a product and stock in Operations to begin.</div>}
        <div className="product-grid">{items.map(product => { const choice = choices[product.id] || 'base'; const selectedPreset = choice.startsWith('preset:') ? product.presets[Number(choice.slice(7))] : undefined; const selectedGrams = choice === 'grams' ? Number(weights[product.id]) : undefined; const needed = selectedPreset?.quantity ?? (choice === 'grams' ? selectedGrams || 0 : product.stock_unit === 'gram' ? 1000 : 1); return <article className="product-tile" key={product.id}><div><strong>{product.name}</strong><span>{product.category || product.sku}{product.barcode ? ` · ${product.barcode}` : ''}</span></div><div className="product-options"><select aria-label={`Selling option for ${product.name}`} value={choice} onChange={event => setChoices(current => ({ ...current, [product.id]: event.target.value }))}><option value="base">{product.stock_unit === 'gram' ? `1 kg · ${money(product.price_minor, context.currency)}` : `1 item · ${money(product.price_minor, context.currency)}`}</option>{product.presets.map((preset, index) => <option key={index} value={`preset:${index}`}>{preset.name} · {money(preset.price_minor, context.currency)}</option>)}{product.stock_unit === 'gram' && <option value="grams">Custom grams</option>}</select>{choice === 'grams' && <input aria-label={`Grams of ${product.name}`} type="number" min="1" max="1000000" step="1" placeholder="Grams" value={weights[product.id] || ''} onChange={event => setWeights(current => ({ ...current, [product.id]: event.target.value }))} />}</div><div className="product-tile-bottom"><span>{choice === 'grams' && selectedGrams ? money(Math.round(product.price_minor * selectedGrams / 1000), context.currency) : selectedPreset ? money(selectedPreset.price_minor, context.currency) : money(product.price_minor, context.currency)}<small>{stockAmount(product.quantity - usedStock(product.id), product.stock_unit)} available</small></span><button type="button" className="secondary-button icon-button" disabled={!Number.isInteger(needed) || needed < 1 || needed > product.quantity - usedStock(product.id)} onClick={() => add(product)} aria-label={`Add ${product.name} to cart`}><CirclePlus size={16} />Add</button></div></article> })}</div>
      </section>
      <section className="panel terminal-cart"><div className="retail-panel-title"><div><h2>Current bill</h2><p>{cartItems.length ? `${cartItems.length} item types in cart` : 'Ready for a new sale'}</p></div><ShoppingBasket size={20} aria-hidden="true" /></div>
        <form onSubmit={checkout}>
          <label className="retail-field">Register<select required value={registerId} onChange={event => setRegisterId(event.target.value)}>{store.registers.map(register => <option key={register.id} value={register.id}>{register.name}</option>)}</select></label>
          {!store.registers.length && <p className="retail-error">This store needs an active register before checkout.</p>}
          <div className="cart-lines">{!cartItems.length && <div className="retail-empty">Select an item to start the bill.</div>}{Object.entries(cart).map(([key, line]) => <div className="cart-line" key={key}><div><strong>{line.product.name}</strong><small>{line.label} · {money(line.priceMinor, context.currency)} each</small></div><div className="cart-controls"><button type="button" aria-label={`Remove one ${line.product.name}`} onClick={() => quantity(key, line.quantity - 1)}>−</button><span>{line.quantity}</span><button type="button" aria-label={`Add one ${line.product.name}`} disabled={usedStock(line.product.id) + line.stockQuantity > line.product.quantity} onClick={() => quantity(key, line.quantity + 1)}>+</button></div><strong>{money(line.priceMinor * line.quantity, context.currency)}</strong><button className="cart-remove" type="button" aria-label={`Remove ${line.product.name}`} onClick={() => quantity(key, 0)}><Trash2 size={15} /></button></div>)}</div>
          <fieldset className="customer-choice"><legend>Customer type</legend><label><input type="radio" name="customer-type" checked={customerType === 'walkin'} onChange={() => setCustomerType('walkin')} />Walk-in</label><label><input type="radio" name="customer-type" checked={customerType === 'daily'} onChange={() => setCustomerType('daily')} />Daily customer</label></fieldset>
          {customerType === 'daily' && <div className="customer-select"><label className="retail-field">Customer<select required value={customerId} onChange={event => setCustomerId(event.target.value)}><option value="">Select a customer</option>{customers.data?.map(customer => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>)}</select></label><button type="button" className="secondary-button" onClick={() => setNewCustomer(true)}>New customer</button></div>}
          <div className="cart-total"><span>Total</span><strong>{money(total, context.currency)}</strong></div>
          <label className="retail-field">Cash received<input type="number" min="0" step="0.01" inputMode="decimal" required value={cash} onChange={event => setCash(event.target.value)} placeholder="0.00" /></label>
          <div className="cart-change"><span>Change to return</span><strong>{money(Math.max(0, tendered - total), context.currency)}</strong></div>
          <p className="retail-helper">Cash payment only for now. Daily customers are linked to bills; credit balances will be added later.</p>
          {error && <p className="retail-error" role="alert">{error}</p>}{message && <p className="retail-success" role="status">{message}</p>}
          <button className="primary-button terminal-checkout" disabled={busy || !cartItems.length || !registerId || tendered < total || (customerType === 'daily' && !customerId)}>{busy ? 'Completing…' : 'Complete sale'}<ArrowRight size={16} /></button>
        </form>
      </section>
    </div>
    <section className="panel recent-bills"><div className="retail-panel-title"><div><h2>Recent bills</h2><p>Find a completed bill to view, edit, or print.</p></div><button type="button" className="secondary-button icon-button" onClick={() => void sales.refetch()}><RefreshCw size={15} />Refresh</button></div><label className="retail-search bill-search"><Search size={17} aria-hidden="true" /><input aria-label="Search bills by receipt number" placeholder="Search receipt number" maxLength={50} value={billSearch} onChange={event => setBillSearch(event.target.value)} /></label>{sales.isPending && <p className="retail-helper" role="status">Loading bills…</p>}{sales.isError && <p className="retail-error" role="alert">{errorText(sales.error)}</p>}{!sales.data?.length && !sales.isPending && !sales.isError && <p className="retail-helper">{billSearch ? 'No bills match that receipt number.' : 'No completed sales at this store yet.'}</p>}<div className="recent-bills-list">{sales.data?.map(sale => <button type="button" key={sale.id} onClick={() => void openReceipt(sale.id)}><span><strong>{sale.receipt_number}</strong><small>{new Date(sale.created).toLocaleString()} · {sale.customer_type === 'daily' ? 'Daily customer' : 'Walk-in'}</small></span><strong>{money(sale.total_minor, context.currency)}</strong></button>)}</div></section>
    {newCustomer && <div className="retail-dialog-backdrop"><form className="panel retail-dialog" onSubmit={createCustomer} aria-label="Add daily customer"><h2>New daily customer</h2><p>Keep purchases connected to this person for future credit features.</p><label className="retail-field">Name<input name="name" required maxLength={160} autoFocus /></label><label className="retail-field">Phone <small>Optional</small><input name="phone" maxLength={40} /></label>{error && <p role="alert" className="retail-error">{error}</p>}<div className="retail-dialog-actions"><button type="button" className="secondary-button" onClick={() => setNewCustomer(false)}>Cancel</button><button className="primary-button" disabled={busy}>Save customer</button></div></form></div>}
    {receipt && !editing && <div className="retail-dialog-backdrop"><div className="panel retail-dialog receipt-dialog" role="dialog" aria-modal="true" aria-label={`Bill ${receipt.receipt_number}`}><div className="receipt-paper"><h2>{receipt.store}</h2><p>{receipt.organization}{receipt.store_address ? ` · ${receipt.store_address}` : ''}</p><div className="receipt-meta"><span>Bill {receipt.receipt_number}</span><span>{new Date(receipt.created).toLocaleString()}</span></div><p>{receipt.customer ? `Customer: ${receipt.customer}` : 'Walk-in customer'}</p><div className="receipt-lines">{receipt.lines.map(line => <div key={line.id}><span>{line.name}<small>{line.quantity} × {line.unit_label} · {money(line.unit_price_minor, receipt.currency)}</small></span><strong>{money(line.line_total_minor, receipt.currency)}</strong></div>)}</div><div className="receipt-total"><span>Total paid</span><strong>{money(receipt.total_minor, receipt.currency)}</strong></div><div className="receipt-meta"><span>Cash received</span><span>{money(receipt.cash_received_minor, receipt.currency)}</span><span>Change</span><span>{money(receipt.change_minor, receipt.currency)}</span></div>{receipt.receipt_footer && <p className="receipt-footer">{receipt.receipt_footer}</p>}</div><div className="retail-dialog-actions receipt-actions"><button type="button" className="secondary-button" onClick={() => setReceipt(null)}>Close</button><button type="button" className="secondary-button icon-button" onClick={beginEdit}><Pencil size={15} />Edit bill</button><button type="button" className="primary-button icon-button" onClick={() => window.print()}><Printer size={16} />Print bill</button></div></div></div>}
    {receipt && editing && <div className="retail-dialog-backdrop"><form className="panel retail-dialog bill-edit-dialog" role="dialog" aria-modal="true" aria-label={`Edit bill ${receipt.receipt_number}`} onSubmit={saveBill}>
      <h2>Edit bill {receipt.receipt_number}</h2><p>Correct the items, customer, or cash received. Stock and reports update when you save.</p>
      <div className="bill-edit-lines">{editLines.map(line => <div className="bill-edit-line" key={line.id}><div><strong>{line.name}</strong><small>{line.unit_label}</small></div><label className="retail-field">Qty<input type="number" min="1" max="10000" step="1" required value={line.quantity} onChange={event => { const value = Number(event.target.value); setEditLines(current => current.map(item => item.id === line.id ? { ...item, quantity: value } : item)) }} /></label><label className="retail-field">Unit price<input type="number" min="0" max="10000000" step="0.01" required defaultValue={(line.unit_price_minor / 100).toFixed(2)} onChange={event => setEditLines(current => current.map(item => item.id === line.id ? { ...item, unit_price_minor: minor(event.target.value) } : item))} /></label><strong>{money(line.unit_price_minor * line.quantity, receipt.currency)}</strong><button type="button" className="cart-remove" aria-label={`Remove ${line.name}`} onClick={() => setEditLines(current => current.filter(item => item.id !== line.id))}><Trash2 size={17} /></button></div>)}</div>
      <div className="bill-add-item"><h3>Add an item</h3><label className="retail-field">Search products<input value={editSearch} onChange={event => { setEditSearch(event.target.value); setEditProductId(''); setEditChoice('base') }} placeholder="Name, SKU, or barcode" /></label><label className="retail-field">Product<select value={editProductId} onChange={event => { setEditProductId(event.target.value); setEditChoice('base') }}><option value="">Select an item</option>{editProducts.data?.map(product => <option key={product.id} value={product.id}>{product.name} · {stockAmount(product.quantity, product.stock_unit)} available</option>)}</select></label>{editProduct && <><label className="retail-field">Selling option<select value={editChoice} onChange={event => setEditChoice(event.target.value)}><option value="base">{editProduct.stock_unit === 'gram' ? '1 kg' : 'Each'}</option>{editProduct.presets.map((preset, index) => <option key={index} value={`preset:${index}`}>{preset.name}</option>)}{editProduct.stock_unit === 'gram' && <option value="grams">Custom grams</option>}</select></label>{editChoice === 'grams' && <label className="retail-field">Grams<input type="number" min="1" max="1000000" step="1" value={editGrams} onChange={event => setEditGrams(event.target.value)} /></label>}<button type="button" className="secondary-button icon-button" onClick={addEditLine}><CirclePlus size={16} />Add to bill</button></>}</div>
      <fieldset className="customer-choice"><legend>Customer type</legend><label><input type="radio" checked={editCustomerType === 'walkin'} onChange={() => setEditCustomerType('walkin')} />Walk-in</label><label><input type="radio" checked={editCustomerType === 'daily'} onChange={() => setEditCustomerType('daily')} />Daily customer</label></fieldset>
      {editCustomerType === 'daily' && <label className="retail-field">Customer<select required value={editCustomerId} onChange={event => setEditCustomerId(event.target.value)}><option value="">Select a customer</option>{customers.data?.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>}
      <div className="cart-total"><span>Corrected total</span><strong>{money(editTotal, receipt.currency)}</strong></div><label className="retail-field">Cash received<input type="number" min="0" max="20000000" step="0.01" required value={editCash} onChange={event => setEditCash(event.target.value)} /></label><div className="cart-change"><span>Change to return</span><strong>{money(Math.max(0, minor(editCash) - editTotal), receipt.currency)}</strong></div>
      {editError && <p className="retail-error" role="alert">{editError}</p>}<div className="retail-dialog-actions"><button type="button" className="secondary-button" onClick={() => setEditing(false)} disabled={busy}>Cancel</button><button className="primary-button" disabled={busy || !editLines.length || editLines.some(line => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10000) || minor(editCash) < editTotal || (editCustomerType === 'daily' && !editCustomerId)}>{busy ? 'Saving…' : 'Save changes'}</button></div>
    </form></div>}
  </>
}

export function Operations({ memberships }: { memberships: Membership[] }) {
  return <Workspace memberships={memberships} permission="store.read" title="Operations" description="Add items, receive stock, and see what is available at this store.">{scope => <OperationsDesk key={`${scope.membership.organization_id}-${scope.store.id}`} scope={scope} mode="operations" />}</Workspace>
}

export function ReportPage({ memberships }: { memberships: Membership[] }) {
  return <Workspace memberships={memberships} permission="reports.read" title="Report" description="Review cash sales and critical stock for each store business day.">{scope => <OperationsDesk key={`${scope.membership.organization_id}-${scope.store.id}`} scope={scope} mode="report" />}</Workspace>
}

function OperationsDesk({ scope, mode }: { scope: Scope; mode: 'operations' | 'report' }) {
  const { membership, context, store } = scope
  const orgId = membership.organization_id
  const cache = useQueryClient()
  const [tab, setTab] = useState<'add' | 'update' | 'status' | 'reports'>(mode === 'report' ? 'reports' : 'add')
  const [advanced, setAdvanced] = useState(false)
  const [stockUnit, setStockUnit] = useState<'piece' | 'gram'>('piece')
  const [presets, setPresets] = useState<{ name: string; quantity: string; price: string }[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [stockPreset, setStockPreset] = useState('base')
  const [stockSearch, setStockSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deletePosition, setDeletePosition] = useState({ top: 0, left: 0 })
  const [deleteError, setDeleteError] = useState('')
  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [editPresets, setEditPresets] = useState<{ name: string; quantity: string; price: string }[]>([])
  const [editError, setEditError] = useState('')
  const deletePopoverRef = useRef<HTMLDivElement>(null)
  const deleteAnchorRef = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [day, setDay] = useState('')
  const canCatalog = membership.permissions.includes('catalog.manage') && membership.all_stores
  const canStock = membership.permissions.includes('inventory.manage')
  const canReport = membership.permissions.includes('reports.read')
  const stock = useQuery<Product[]>({ queryKey: ['operations-stock', orgId, store.id], queryFn: () => operationsRequest<Product[]>(orgId, `stores/${store.id}/stock`), enabled: mode === 'operations', retry: false })
  const report = useQuery<Report>({ queryKey: ['operations-report', orgId, store.id, day], queryFn: () => operationsRequest<Report>(orgId, `stores/${store.id}/reports${day ? `?day=${day}` : ''}`), enabled: mode === 'report' && canReport, retry: false })
  const movements = useQuery<Movement[]>({ queryKey: ['operations-movements', orgId, store.id], queryFn: () => operationsRequest<Movement[]>(orgId, `stores/${store.id}/movements`), enabled: mode === 'operations' && canReport && tab === 'status', retry: false })
  const stockRows = stock.data || []
  const selected = stockRows.find(item => item.id === selectedProduct)
  const lowCount = stockRows.filter(item => item.low_stock && item.active).length
  const filtered = stockRows.filter(item => `${item.name} ${item.sku} ${item.category || ''}`.toLowerCase().includes(stockSearch.toLowerCase()))
  const itemMatches = itemSearch.trim() ? stockRows.filter(item => `${item.name} ${item.sku} ${item.barcode || ''} ${item.category || ''}`.toLowerCase().includes(itemSearch.trim().toLowerCase())) : []
  useEffect(() => {
    if (!deleteTarget) return
    const target = deleteTarget
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDeleteTarget(null)
        deleteAnchorRef.current?.focus()
      }
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!deletePopoverRef.current?.contains(target) && !deleteAnchorRef.current?.contains(target)) {
        setDeleteTarget(null)
      }
    }
    function onScrollOrResize() {
      if (deleteAnchorRef.current?.isConnected) {
        setDeletePosition(deletePopoverPosition(target, deleteAnchorRef.current))
      } else {
        setDeleteTarget(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    deletePopoverRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [deleteTarget])
  function showTab(next: 'add' | 'update' | 'status') { setTab(next); setError(''); setMessage('') }
  function openEdit(item: Product) {
    setEditTarget(item)
    setEditPresets(item.presets.map(preset => ({ name: preset.name, quantity: String(preset.quantity), price: String(preset.price_minor / 100) })))
    setEditError('')
  }
  async function updateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editTarget) return
    setBusy(true); setEditError(''); setError(''); setMessage('')
    const values = new FormData(event.currentTarget)
    try {
      if (editPresets.some(preset => !preset.name.trim() || !preset.quantity || !preset.price)) throw new Error('Complete the name, size, and price for each preset.')
      await operationsRequest(orgId, `products/${editTarget.id}`, 'PUT', {
        name: String(values.get('name') || '').trim(),
        sku: String(values.get('sku') || '').trim(),
        barcode: String(values.get('barcode') || '').trim() || null,
        category: String(values.get('category') || '').trim() || null,
        stock_unit: editTarget.stock_unit,
        presets: editPresets.map(preset => ({ name: preset.name.trim(), quantity: Number(preset.quantity), price_minor: minor(preset.price) })),
        price_minor: minor(String(values.get('price') || '0')),
        cost_minor: minor(String(values.get('cost') || '0')),
        low_stock_threshold: Number(values.get('threshold') || '0'),
      })
      setEditTarget(null)
      setMessage('Item details updated.')
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['operations-stock', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['terminal-products', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['operations-report', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['operations-movements', orgId, store.id] }),
      ])
    } catch (reason) { setEditError(errorText(reason)) } finally { setBusy(false) }
  }
  function openDeletePopover(item: Product, event: MouseEvent<HTMLButtonElement>) {
    const button = event.currentTarget
    deleteAnchorRef.current = button
    setDeletePosition(deletePopoverPosition(item, button))
    setDeleteError('')
    setDeleteTarget(item)
  }
  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const form = event.currentTarget
    const values = new FormData(form)
    try {
      if (presets.some(preset => !preset.name.trim() || !preset.quantity || !preset.price)) throw new Error('Complete the name, size, and price for each preset.')
      await operationsRequest(orgId, 'products', 'POST', {
        name: String(values.get('name') || '').trim(),
        sku: String(values.get('sku') || '').trim() || `ITEM-${crypto.randomUUID().toUpperCase()}`,
        barcode: String(values.get('barcode') || '').trim() || null,
        category: String(values.get('category') || '').trim() || null,
        stock_unit: stockUnit,
        presets: presets.map(preset => ({ name: preset.name.trim(), quantity: Number(preset.quantity), price_minor: minor(preset.price) })),
        price_minor: minor(String(values.get('price') || '0')),
        cost_minor: minor(String(values.get('cost') || '0')),
        low_stock_threshold: Number(values.get('threshold') || (stockUnit === 'gram' ? 5000 : 5)),
      })
      form.reset(); setPresets([]); setAdvanced(false); setStockUnit('piece')
      setMessage('Item created. Open Update Stock to add its starting quantity.')
      await cache.invalidateQueries({ queryKey: ['operations-stock', orgId, store.id] })
    } catch (reason) { setError(errorText(reason)) } finally { setBusy(false) }
  }
  async function receiveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const form = event.currentTarget
    const values = new FormData(form)
    try {
      await operationsRequest(orgId, `stores/${store.id}/stock`, 'POST', {
        product_id: selectedProduct, quantity: Number(values.get('quantity')),
        preset_index: stockPreset === 'base' ? null : Number(stockPreset),
        kind: String(values.get('kind')), note: String(values.get('note') || ''),
      })
      form.reset(); setSelectedProduct(''); setItemSearch(''); setStockPreset('base')
      setMessage('Stock added. The new balance is available in Stock Status.')
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['operations-stock', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['operations-movements', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['operations-report', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['terminal-products', orgId, store.id] }),
      ])
    } catch (reason) { setError(errorText(reason)) } finally { setBusy(false) }
  }
  async function deleteItem() {
    if (!deleteTarget) return
    setBusy(true); setDeleteError(''); setError(''); setMessage('')
    try {
      await operationsRequest(orgId, `products/${deleteTarget.id}`, 'DELETE')
      if (selectedProduct === deleteTarget.id) { setSelectedProduct(''); setStockPreset('base') }
      setMessage(`${deleteTarget.name} deleted from the catalog.`)
      setDeleteTarget(null)
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['operations-stock', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['terminal-products', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['operations-report', orgId, store.id] }),
      ])
    } catch (reason) { setDeleteError(errorText(reason)) } finally { setBusy(false) }
  }
  return <>
    {mode === 'operations' && <div className="section-tabs operations-tabs" role="tablist" aria-label="Operations views">
      <button type="button" role="tab" aria-selected={tab === 'add'} className={tab === 'add' ? 'selected' : ''} onClick={() => showTab('add')}><CirclePlus size={16} aria-hidden="true" />Add Items</button>
      <button type="button" role="tab" aria-selected={tab === 'update'} className={tab === 'update' ? 'selected' : ''} onClick={() => showTab('update')}><PackagePlus size={16} aria-hidden="true" />Update Stock</button>
      <button type="button" role="tab" aria-selected={tab === 'status'} className={tab === 'status' ? 'selected' : ''} onClick={() => showTab('status')}><ClipboardList size={16} aria-hidden="true" />Stock Status</button>
    </div>}
    {error && <p role="alert" className="retail-error retail-feedback">{error}</p>}{message && <p role="status" className="retail-success retail-feedback">{message}</p>}
    {tab === 'add' && <section className="panel catalog-panel"><div className="retail-panel-title"><div><h2>Add an item</h2><p>Set its selling price now. Add quantities for {store.name} in Update Stock.</p></div><CirclePlus size={20} aria-hidden="true" /></div>
      {canCatalog ? <form className="retail-form catalog-form" onSubmit={createProduct}>
        <label className="retail-field">Product name<input name="name" maxLength={160} required placeholder="e.g. Rice" /></label>
        <label className="retail-field">Selling price per {stockUnit === 'gram' ? 'kg' : 'item'} ({context.currency})<input name="price" type="number" min="0" max="10000000" step="0.01" required placeholder="0.00" /></label>
        <label className="retail-field">Cost per {stockUnit === 'gram' ? 'kg' : 'item'} ({context.currency}) <small>Optional · used for profit estimates</small><input name="cost" type="number" min="0" max="10000000" step="0.01" placeholder="0.00" /></label>
        <label className="retail-field">Category <small>Optional · helps with sorting later</small><input name="category" maxLength={80} placeholder="e.g. Grocery" /></label>
        <div className="advanced-section"><button className="advanced-toggle" type="button" aria-expanded={advanced} onClick={() => setAdvanced(value => !value)}><span className="advanced-toggle-label">{advanced ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}Advanced options</span><span className="advanced-toggle-description">{advanced ? 'Hide' : 'Barcode, units, and presets'}</span></button>
          {advanced && <div className="advanced-content"><div className="retail-form-row"><label className="retail-field">Barcode <small>Optional</small><input name="barcode" maxLength={80} placeholder="Scan or enter code" /></label><label className="retail-field">SKU <small>Optional · generated if blank</small><input name="sku" maxLength={60} placeholder="e.g. RICE-01" /></label></div>
            <div className="retail-form-row"><label className="retail-field">How is it sold?<select value={stockUnit} onChange={event => { setStockUnit(event.target.value as 'piece' | 'gram'); setPresets([]) }}><option value="piece">By item (pieces)</option><option value="gram">By weight (kg or grams)</option></select></label><label className="retail-field">Low stock alert at <small>{stockUnit === 'gram' ? 'grams' : 'pieces'}</small><input key={stockUnit} name="threshold" type="number" min="0" max="1000000" defaultValue={stockUnit === 'gram' ? '5000' : '5'} /></label></div>
            <div className="preset-editor"><div><strong>Presets</strong><p>Add a pack or bag that can be received and sold as one selection. Stock is always counted in {stockUnit === 'gram' ? 'grams' : 'pieces'}.</p></div>
              {presets.map((preset, index) => <div className="preset-row" key={index}><label className="retail-field">Preset name<input aria-label={`Preset ${index + 1} name`} value={preset.name} maxLength={60} placeholder={stockUnit === 'gram' ? '25 kg bag' : 'Box of 12'} onChange={event => setPresets(rows => rows.map((row, i) => i === index ? { ...row, name: event.target.value } : row))} /></label><label className="retail-field">{stockUnit === 'gram' ? 'Grams in preset' : 'Items in preset'}<input type="number" min="1" max="1000000" value={preset.quantity} onChange={event => setPresets(rows => rows.map((row, i) => i === index ? { ...row, quantity: event.target.value } : row))} /></label><label className="retail-field">Selling price per {preset.name.trim() || 'preset'} ({context.currency})<input type="number" min="0" step="0.01" value={preset.price} onChange={event => setPresets(rows => rows.map((row, i) => i === index ? { ...row, price: event.target.value } : row))} /></label><button type="button" className="secondary-button icon-button" aria-label={`Remove preset ${index + 1}`} onClick={() => setPresets(rows => rows.filter((_, i) => i !== index))}><Trash2 size={15} aria-hidden="true" />Remove</button></div>)}
              <button type="button" className="secondary-button icon-button" disabled={presets.length >= 8} onClick={() => setPresets(rows => [...rows, { name: '', quantity: '', price: '' }])}><Plus size={15} aria-hidden="true" />Add preset</button>
            </div></div>}
        </div>
        <button className="primary-button icon-button" disabled={busy}><CirclePlus size={16} />{busy ? 'Saving…' : 'Add item'}</button>
      </form> : <p className="retail-helper">Adding items requires organization-wide catalog permission.</p>}</section>}
    {tab === 'update' && <section className="panel stock-update-panel"><div className="retail-panel-title"><div><h2>Update stock</h2><p>Receive an opening balance or a new delivery at {store.name}.</p></div><PackagePlus size={20} aria-hidden="true" /></div>
      {canStock ? <form className="retail-form" onSubmit={receiveStock}>
        {!selected ? <div className="stock-picker"><label className="retail-field" htmlFor="stock-item-search">Find an item</label><div className="stock-picker-search"><Search size={18} aria-hidden="true" /><input id="stock-item-search" type="search" autoComplete="off" placeholder="Search name, SKU, barcode, or category" value={itemSearch} onChange={event => setItemSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (itemMatches.length) { setSelectedProduct(itemMatches[0].id); setStockPreset('base') } } }} /></div>
          {stock.isPending && <p className="retail-helper" role="status">Loading items…</p>}{stock.isError && <p className="retail-error" role="alert">{errorText(stock.error)}</p>}
          {!stock.isPending && !itemSearch.trim() && <p className="retail-helper">Type to find an item in the catalog.</p>}
          {!!itemSearch.trim() && <div className="stock-picker-results" aria-label="Matching items">{itemMatches.slice(0, 10).map(item => <button type="button" key={item.id} onClick={() => { setSelectedProduct(item.id); setStockPreset('base') }}><span><strong>{item.name}</strong><small>{item.sku}{item.category ? ` · ${item.category}` : ''}{item.barcode ? ` · ${item.barcode}` : ''}</small></span><span>{stockAmount(item.quantity, item.stock_unit)}<ArrowRight size={15} aria-hidden="true" /></span></button>)}{!itemMatches.length && !stock.isPending && <p className="retail-empty">No matching items. Try another name, SKU, or barcode.</p>}</div>}
          {itemMatches.length > 10 && <p className="retail-helper">Showing 10 of {itemMatches.length} matches. Keep typing to narrow the list.</p>}
        </div> : <div className="stock-selected"><div><span>Selected item</span><strong>{selected.name}</strong><small>{selected.sku}{selected.category ? ` · ${selected.category}` : ''}</small></div><div><span>Current stock</span><strong>{stockAmount(selected.quantity, selected.stock_unit)}</strong></div><button type="button" className="secondary-button" onClick={() => { setSelectedProduct(''); setItemSearch(''); setStockPreset('base') }}>Change item</button></div>}
        <div className="retail-form-row"><label className="retail-field">Receive as<select value={stockPreset} disabled={!selected} onChange={event => setStockPreset(event.target.value)}><option value="base">{selected?.stock_unit === 'gram' ? 'Grams' : 'Individual items'}</option>{selected?.presets.map((preset, index) => <option key={index} value={index}>{preset.name} ({stockAmount(preset.quantity, selected.stock_unit)})</option>)}</select></label><label className="retail-field">Quantity<input name="quantity" type="number" min="1" max="1000000" required placeholder="0" /></label></div>
        {selected && stockPreset !== 'base' && <p className="retail-helper">Each {selected.presets[Number(stockPreset)].name} adds {stockAmount(selected.presets[Number(stockPreset)].quantity, selected.stock_unit)} to stock.</p>}
        <div className="retail-form-row"><label className="retail-field">Stock type<select name="kind"><option value="receipt">New stock</option><option value="opening">Opening stock</option></select></label><label className="retail-field">Note <small>Optional</small><input name="note" maxLength={300} placeholder="Invoice or delivery reference" /></label></div>
        <button className="primary-button icon-button" disabled={busy || !selected}><PackagePlus size={16} />{busy ? 'Saving…' : 'Add stock'}</button>
      </form> : <p className="retail-helper">You can view stock but do not have permission to update it.</p>}
      {!stock.isPending && !stockRows.length && <p className="retail-helper">No items yet. Add an item first.</p>}
    </section>}
    {tab === 'status' && <><div className="operations-summary"><div><span>Items</span><strong>{stockRows.length}</strong><small>In the catalog</small></div><div className={lowCount ? 'needs-attention' : ''}><span>Low stock</span><strong>{lowCount}</strong><small>Need attention</small></div><div><span>Store</span><strong className="summary-store">{store.name}</strong><small>Current balances</small></div></div>
      <section className="panel"><div className="retail-panel-title"><div><h2>Stock status</h2><p>Quantities at {store.name}, counted in pieces or weight.</p></div><AlertTriangle size={19} aria-hidden="true" /></div>
        <label className="retail-search"><Search size={17} aria-hidden="true" /><input aria-label="Search stock" placeholder="Search name, SKU, or category" value={stockSearch} onChange={event => setStockSearch(event.target.value)} /></label>
        {stock.isPending && <p role="status" className="retail-helper">Loading stock…</p>}{stock.isError && <p role="alert" className="retail-error">{errorText(stock.error)}</p>}
        <div className="retail-table-wrap"><table className="retail-table stock-status-table"><thead><tr><th>Item</th><th>Category</th><th>On hand</th><th>Status</th>{(canCatalog || canStock) && <th className="stock-actions-heading">Actions</th>}</tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td><strong>{item.name}</strong><small className="stock-sku">{item.sku}</small></td><td>{item.category || '—'}</td><td>{stockAmount(item.quantity, item.stock_unit)}</td><td><span className={item.low_stock ? 'stock-badge low' : 'stock-badge'}>{item.low_stock ? 'Low' : 'Healthy'}</span></td>{(canCatalog || canStock) && <td className="stock-actions"><div className="stock-action-list">{canStock && <button type="button" className="stock-action-button" onClick={() => { setSelectedProduct(item.id); setItemSearch(''); setStockPreset('base'); showTab('update') }} aria-label={`Update stock for ${item.name}`}><PackagePlus size={15} aria-hidden="true" />Stock</button>}{canCatalog && <button type="button" className="stock-action-button" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`}><Pencil size={15} aria-hidden="true" />Edit</button>}{canCatalog && <button type="button" className="stock-delete-button" onClick={event => openDeletePopover(item, event)} aria-label={`Delete ${item.name}`} aria-haspopup="dialog" aria-expanded={deleteTarget?.id === item.id} aria-controls={deleteTarget?.id === item.id ? 'delete-stock-popover' : undefined}><Trash2 size={15} aria-hidden="true" />Delete</button>}</div></td>}</tr>)}</tbody></table><div className="stock-mobile-list">{filtered.map(item => <article className="stock-mobile-card" key={item.id}><div className="stock-mobile-card-heading"><div><strong>{item.name}</strong><small>{item.sku}{item.category ? ` · ${item.category}` : ''}</small></div><span className={item.low_stock ? 'stock-badge low' : 'stock-badge'}>{item.low_stock ? 'Low' : 'Healthy'}</span></div><div className="stock-mobile-balance"><span>On hand</span><strong>{stockAmount(item.quantity, item.stock_unit)}</strong></div>{(canCatalog || canStock) && <div className="stock-action-list">{canStock && <button type="button" className="stock-action-button" onClick={() => { setSelectedProduct(item.id); setItemSearch(''); setStockPreset('base'); showTab('update') }} aria-label={`Update stock for ${item.name}`}><PackagePlus size={15} aria-hidden="true" />Stock</button>}{canCatalog && <button type="button" className="stock-action-button" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`}><Pencil size={15} aria-hidden="true" />Edit</button>}{canCatalog && <button type="button" className="stock-delete-button" onClick={event => openDeletePopover(item, event)} aria-label={`Delete ${item.name}`} aria-haspopup="dialog" aria-expanded={deleteTarget?.id === item.id} aria-controls={deleteTarget?.id === item.id ? 'delete-stock-popover' : undefined}><Trash2 size={15} aria-hidden="true" />Delete</button>}</div>}</article>)}</div>{!filtered.length && !stock.isPending && <p className="retail-empty">{stockRows.length ? 'No matching items.' : 'No items yet. Add one in Add Items.'}</p>}</div>
      </section>
      {canReport && <section className="panel movement-panel"><div className="retail-panel-title"><div><h2>Recent stock changes</h2><p>Deliveries and sales at this store.</p></div></div>{movements.isPending && <p className="retail-helper">Loading movements…</p>}{movements.isError && <p className="retail-error">{errorText(movements.error)}</p>}<div className="movement-list">{movements.data?.slice(0, 20).map(movement => <div key={movement.id}><span><strong>{movement.product_name}</strong><small>{movement.kind} · {new Date(movement.created).toLocaleString()}{movement.note ? ` · ${movement.note}` : ''}</small></span><strong className={movement.delta < 0 ? 'outgoing' : 'incoming'}>{movement.delta > 0 ? '+' : '−'}{stockAmount(Math.abs(movement.delta), movement.stock_unit)}</strong></div>)}{!movements.data?.length && !movements.isPending && <p className="retail-helper">No stock changes recorded yet.</p>}</div></section>}
    </>}
    {editTarget && <div className="retail-dialog-backdrop"><form key={editTarget.id} className="panel retail-dialog edit-item-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-item-title" onSubmit={updateProduct}>
      <div className="edit-item-heading"><Pencil size={20} aria-hidden="true" /><div><h2 id="edit-item-title">Edit {editTarget.name}</h2><p>Changes to this item apply to every store. Stock stays counted in {editTarget.stock_unit === 'gram' ? 'grams' : 'pieces'}.</p></div></div>
      <div className="edit-item-fields"><label className="retail-field">Product name<input name="name" defaultValue={editTarget.name} maxLength={160} required autoFocus /></label><label className="retail-field">Selling price per {editTarget.stock_unit === 'gram' ? 'kg' : 'item'} ({context.currency})<input name="price" type="number" min="0" max="10000000" step="0.01" defaultValue={editTarget.price_minor / 100} required /></label><label className="retail-field">Cost per {editTarget.stock_unit === 'gram' ? 'kg' : 'item'} ({context.currency})<input name="cost" type="number" min="0" max="10000000" step="0.01" defaultValue={editTarget.cost_minor / 100} /></label><label className="retail-field">Category <small>Optional</small><input name="category" maxLength={80} defaultValue={editTarget.category || ''} /></label><label className="retail-field">SKU<input name="sku" maxLength={60} defaultValue={editTarget.sku} required /></label><label className="retail-field">Barcode <small>Optional</small><input name="barcode" maxLength={80} defaultValue={editTarget.barcode || ''} /></label><label className="retail-field">Low stock alert at <small>{editTarget.stock_unit === 'gram' ? 'grams' : 'pieces'}</small><input name="threshold" type="number" min="0" max="1000000" defaultValue={editTarget.low_stock_threshold} required /></label></div>
      <div className="preset-editor"><div><strong>Presets</strong><p>Set the selling price for one of each preset.</p></div>{editPresets.map((preset, index) => <div className="preset-row" key={index}><label className="retail-field">Preset name<input aria-label={`Edit preset ${index + 1} name`} maxLength={60} value={preset.name} onChange={event => setEditPresets(rows => rows.map((row, i) => i === index ? { ...row, name: event.target.value } : row))} /></label><label className="retail-field">{editTarget.stock_unit === 'gram' ? 'Grams in preset' : 'Items in preset'}<input type="number" min="1" max="1000000" value={preset.quantity} onChange={event => setEditPresets(rows => rows.map((row, i) => i === index ? { ...row, quantity: event.target.value } : row))} /></label><label className="retail-field">Selling price per {preset.name.trim() || 'preset'} ({context.currency})<input type="number" min="0" step="0.01" value={preset.price} onChange={event => setEditPresets(rows => rows.map((row, i) => i === index ? { ...row, price: event.target.value } : row))} /></label><button type="button" className="secondary-button icon-button" aria-label={`Remove edit preset ${index + 1}`} onClick={() => setEditPresets(rows => rows.filter((_, i) => i !== index))}><Trash2 size={15} aria-hidden="true" />Remove</button></div>)}<button type="button" className="secondary-button icon-button" disabled={editPresets.length >= 8} onClick={() => setEditPresets(rows => [...rows, { name: '', quantity: '', price: '' }])}><Plus size={15} aria-hidden="true" />Add preset</button></div>
      {editError && <p className="retail-error" role="alert">{editError}</p>}<div className="retail-dialog-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setEditTarget(null)}>Cancel</button><button type="submit" className="primary-button icon-button" disabled={busy}><Pencil size={16} aria-hidden="true" />{busy ? 'Saving…' : 'Save changes'}</button></div>
    </form></div>}
    {deleteTarget && createPortal(<div id="delete-stock-popover" className="stock-delete-popover" role="dialog" aria-labelledby="delete-stock-title" ref={deletePopoverRef} style={deletePosition}>
      <div className="delete-item-heading"><Trash2 size={18} aria-hidden="true" /><h2 id="delete-stock-title">Are you sure?</h2></div>
      <p>Delete <strong>{deleteTarget.name}</strong> from stock and sales at every store? Past bills and stock records will remain.</p>
      {deleteTarget.quantity > 0 && <p className="delete-stock-warning">Current stock at {store.name}: <strong>{stockAmount(deleteTarget.quantity, deleteTarget.stock_unit)}</strong>. This balance will no longer appear in active stock.</p>}
      {deleteError && <p className="retail-error" role="alert">{deleteError}</p>}
      <div className="retail-dialog-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => { setDeleteTarget(null); deleteAnchorRef.current?.focus() }}>Cancel</button><button type="button" className="danger-button icon-button" disabled={busy} onClick={() => void deleteItem()}><Trash2 size={16} aria-hidden="true" />{busy ? 'Deleting…' : 'Delete stock'}</button></div>
    </div>, document.body)}
    {tab === 'reports' && <>{canReport ? <><div className="report-toolbar"><label className="retail-field">Business day<input type="date" value={day} onChange={event => setDay(event.target.value)} /></label><span>{report.data?.timezone || 'Store local time'}</span><button className="secondary-button icon-button" onClick={() => void report.refetch()}><RefreshCw size={15} />Refresh</button></div>{report.isPending && <div className="panel retail-empty" role="status">Loading report…</div>}{report.isError && <div className="panel retail-error" role="alert">{errorText(report.error)}</div>}{report.data && <><div className="report-metrics"><div className="panel"><span>Sales</span><strong>{report.data.sale_count}</strong><small>{report.data.units_sold} units sold</small></div><div className="panel"><span>Cash collected</span><strong>{money(report.data.cash_collected_minor, report.data.currency)}</strong><small>Completed cash bills</small></div><div className="panel"><span>Gross profit estimate</span><strong>{money(report.data.estimated_gross_profit_minor, report.data.currency)}</strong><small>Sales less recorded unit cost</small></div></div><div className="operations-columns"><section className="panel"><div className="retail-panel-title"><div><h2>Sales on {report.data.date}</h2><p>Bills created during the store’s business day.</p></div></div><div className="movement-list">{report.data.sales.map(sale => <div key={sale.id}><span><strong>{sale.receipt_number}</strong><small>{new Date(sale.created).toLocaleString()} · {sale.customer_type}</small></span><strong>{money(sale.total_minor, report.data.currency)}</strong></div>)}{!report.data.sales.length && <p className="retail-helper">No sales for this day.</p>}</div></section><section className="panel"><div className="retail-panel-title"><div><h2>Critical stock</h2><p>At or below the item’s low-stock threshold.</p></div></div><div className="movement-list">{report.data.low_stock.map(item => <div key={item.product_id}><span><strong>{item.name}</strong><small>{item.sku} · alert at {stockAmount(item.threshold, item.stock_unit)}</small></span><strong className="outgoing">{stockAmount(item.quantity, item.stock_unit)} left</strong></div>)}{!report.data.low_stock.length && <p className="retail-helper">No low-stock items.</p>}</div></section></div></>}</> : <div className="panel retail-empty">Reports require the reports permission.</div>}</>}
  </>
}
