import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { AlertTriangle, ArrowRight, CirclePlus, PackagePlus, Printer, RefreshCw, Search, ShoppingBasket, Trash2 } from 'lucide-react'
import { authenticatedRequest } from './api-client'
import type { Identity } from './session'
import './operations.css'

type Membership = Identity['memberships'][number]
type Register = { id: string; code: string; name: string }
type Store = { id: string; code: string; name: string; registers: Register[] }
type Context = { organization: string; currency: string; stores: Store[] }
type Product = { id: string; name: string; sku: string; barcode: string | null; price_minor: number; cost_minor: number; quantity: number; low_stock_threshold: number; low_stock: boolean; active: boolean }
type Customer = { id: string; name: string; phone: string | null }
type Receipt = { id: string; receipt_number: string; created: string; organization: string; store: string; store_address: string; receipt_footer: string; currency: string; customer_type: 'walkin' | 'daily'; customer: string | null; total_minor: number; cash_received_minor: number; change_minor: number; lines: { product_id: string; name: string; sku: string; quantity: number; unit_price_minor: number; line_total_minor: number }[] }
type SaleSummary = { id: string; receipt_number: string; created: string; total_minor: number; customer_type: string }
type Report = { date: string; timezone: string; currency: string; sale_count: number; units_sold: number; gross_sales_minor: number; cash_collected_minor: number; estimated_cost_minor: number; estimated_gross_profit_minor: number; low_stock: { product_id: string; name: string; sku: string; quantity: number; threshold: number }[]; sales: SaleSummary[] }
type Movement = { id: string; product_name: string; kind: string; delta: number; created: string; note: string }
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
function errorText(reason: unknown) { return reason instanceof Error ? reason.message : 'Please try again.' }

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
  const [cart, setCart] = useState<Record<string, { product: Product; quantity: number }>>({})
  const [customerType, setCustomerType] = useState<'walkin' | 'daily'>('walkin')
  const [customerId, setCustomerId] = useState('')
  const [newCustomer, setNewCustomer] = useState(false)
  const [cash, setCash] = useState('')
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID())
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const products = useQuery<Product[]>({ queryKey: ['terminal-products', orgId, store.id, term], queryFn: () => operationsRequest<Product[]>(orgId, `stores/${store.id}/products?query=${encodeURIComponent(term)}`), retry: false })
  const customers = useQuery<Customer[]>({ queryKey: ['terminal-customers', orgId], queryFn: () => operationsRequest<Customer[]>(orgId, 'customers'), retry: false })
  const sales = useQuery<SaleSummary[]>({ queryKey: ['terminal-sales', orgId, store.id], queryFn: () => operationsRequest<SaleSummary[]>(orgId, `stores/${store.id}/sales`), retry: false })
  const items = (products.data || []).filter(product => product.active)
  const cartItems = Object.values(cart)
  const total = cartItems.reduce((sum, line) => sum + line.product.price_minor * line.quantity, 0)
  const tendered = minor(cash)

  function add(product: Product) { setCart(current => ({ ...current, [product.id]: { product, quantity: Math.min(product.quantity, (current[product.id]?.quantity || 0) + 1) } })); setError('') }
  function quantity(id: string, value: number) { setCart(current => { const next = { ...current }; if (value <= 0) delete next[id]; else next[id] = { ...next[id], quantity: value }; return next }) }
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
        lines: cartItems.map(line => ({ product_id: line.product.id, quantity: line.quantity })),
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
  return <>
    <div className="terminal-layout">
      <section className="panel terminal-catalog"><div className="retail-panel-title"><div><h2>Find an item</h2><p>Search by name, SKU, or barcode.</p></div><Search size={20} aria-hidden="true" /></div>
        <label className="retail-search"><Search size={17} aria-hidden="true" /><input autoFocus aria-label="Search products" placeholder="Search items or scan a barcode" value={search} onChange={event => setSearch(event.target.value)} /></label>
        {products.isPending && <p className="retail-helper" role="status">Loading products…</p>}
        {products.isError && <p className="retail-error" role="alert">{errorText(products.error)}</p>}
        {!products.isPending && !items.length && <div className="retail-empty">No items found. Add a product and stock in Operations to begin.</div>}
        <div className="product-grid">{items.map(product => <article className="product-tile" key={product.id}><div><strong>{product.name}</strong><span>{product.sku}{product.barcode ? ` · ${product.barcode}` : ''}</span></div><div className="product-tile-bottom"><span>{money(product.price_minor, context.currency)}<small>{product.quantity} in stock</small></span><button type="button" className="secondary-button icon-button" disabled={!product.quantity || (cart[product.id]?.quantity || 0) >= product.quantity} onClick={() => add(product)} aria-label={`Add ${product.name} to cart`}><CirclePlus size={16} />Add</button></div></article>)}</div>
      </section>
      <section className="panel terminal-cart"><div className="retail-panel-title"><div><h2>Current bill</h2><p>{cartItems.length ? `${cartItems.length} item types in cart` : 'Ready for a new sale'}</p></div><ShoppingBasket size={20} aria-hidden="true" /></div>
        <form onSubmit={checkout}>
          <label className="retail-field">Register<select required value={registerId} onChange={event => setRegisterId(event.target.value)}>{store.registers.map(register => <option key={register.id} value={register.id}>{register.name}</option>)}</select></label>
          {!store.registers.length && <p className="retail-error">This store needs an active register before checkout.</p>}
          <div className="cart-lines">{!cartItems.length && <div className="retail-empty">Select an item to start the bill.</div>}{cartItems.map(({ product, quantity: count }) => <div className="cart-line" key={product.id}><div><strong>{product.name}</strong><small>{money(product.price_minor, context.currency)} each</small></div><div className="cart-controls"><button type="button" aria-label={`Remove one ${product.name}`} onClick={() => quantity(product.id, count - 1)}>−</button><span>{count}</span><button type="button" aria-label={`Add one ${product.name}`} disabled={count >= product.quantity} onClick={() => quantity(product.id, count + 1)}>+</button></div><strong>{money(product.price_minor * count, context.currency)}</strong><button className="cart-remove" type="button" aria-label={`Remove ${product.name}`} onClick={() => quantity(product.id, 0)}><Trash2 size={15} /></button></div>)}</div>
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
    <section className="panel recent-bills"><div className="retail-panel-title"><div><h2>Recent bills</h2><p>Open and print a completed bill.</p></div><button type="button" className="secondary-button icon-button" onClick={() => void sales.refetch()}><RefreshCw size={15} />Refresh</button></div>{sales.isError && <p className="retail-error">{errorText(sales.error)}</p>}{!sales.data?.length && !sales.isPending && <p className="retail-helper">No completed sales at this store yet.</p>}<div className="recent-bills-list">{sales.data?.slice(0, 10).map(sale => <button type="button" key={sale.id} onClick={() => void openReceipt(sale.id)}><span><strong>{sale.receipt_number}</strong><small>{new Date(sale.created).toLocaleString()} · {sale.customer_type === 'daily' ? 'Daily customer' : 'Walk-in'}</small></span><strong>{money(sale.total_minor, context.currency)}</strong></button>)}</div></section>
    {newCustomer && <div className="retail-dialog-backdrop"><form className="panel retail-dialog" onSubmit={createCustomer} aria-label="Add daily customer"><h2>New daily customer</h2><p>Keep purchases connected to this person for future credit features.</p><label className="retail-field">Name<input name="name" required maxLength={160} autoFocus /></label><label className="retail-field">Phone <small>Optional</small><input name="phone" maxLength={40} /></label>{error && <p role="alert" className="retail-error">{error}</p>}<div className="retail-dialog-actions"><button type="button" className="secondary-button" onClick={() => setNewCustomer(false)}>Cancel</button><button className="primary-button" disabled={busy}>Save customer</button></div></form></div>}
    {receipt && <div className="retail-dialog-backdrop"><div className="panel retail-dialog receipt-dialog" role="dialog" aria-modal="true" aria-label={`Bill ${receipt.receipt_number}`}><div className="receipt-paper"><h2>{receipt.store}</h2><p>{receipt.organization}{receipt.store_address ? ` · ${receipt.store_address}` : ''}</p><div className="receipt-meta"><span>Bill {receipt.receipt_number}</span><span>{new Date(receipt.created).toLocaleString()}</span></div><p>{receipt.customer ? `Customer: ${receipt.customer}` : 'Walk-in customer'}</p><div className="receipt-lines">{receipt.lines.map(line => <div key={line.product_id}><span>{line.name}<small>{line.quantity} × {money(line.unit_price_minor, receipt.currency)}</small></span><strong>{money(line.line_total_minor, receipt.currency)}</strong></div>)}</div><div className="receipt-total"><span>Total paid</span><strong>{money(receipt.total_minor, receipt.currency)}</strong></div><div className="receipt-meta"><span>Cash received</span><span>{money(receipt.cash_received_minor, receipt.currency)}</span><span>Change</span><span>{money(receipt.change_minor, receipt.currency)}</span></div>{receipt.receipt_footer && <p className="receipt-footer">{receipt.receipt_footer}</p>}</div><div className="retail-dialog-actions receipt-actions"><button type="button" className="secondary-button" onClick={() => setReceipt(null)}>Close</button><button type="button" className="primary-button icon-button" onClick={() => window.print()}><Printer size={16} />Print bill</button></div></div></div>}
  </>
}

export function Operations({ memberships }: { memberships: Membership[] }) {
  return <Workspace memberships={memberships} permission="store.read" title="Operations" description="Maintain products and stock, then review the numbers that need attention.">{scope => <OperationsDesk key={`${scope.membership.organization_id}-${scope.store.id}`} scope={scope} mode="operations" />}</Workspace>
}

export function ReportPage({ memberships }: { memberships: Membership[] }) {
  return <Workspace memberships={memberships} permission="reports.read" title="Report" description="Review cash sales and critical stock for each store business day.">{scope => <OperationsDesk key={`${scope.membership.organization_id}-${scope.store.id}`} scope={scope} mode="report" />}</Workspace>
}

function OperationsDesk({ scope, mode }: { scope: Scope; mode: 'operations' | 'report' }) {
  const { membership, context, store } = scope
  const orgId = membership.organization_id
  const cache = useQueryClient()
  const [tab, setTab] = useState<'stock' | 'catalog' | 'reports'>(mode === 'report' ? 'reports' : 'stock')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [day, setDay] = useState('')
  const canCatalog = membership.permissions.includes('catalog.manage') && membership.all_stores
  const canStock = membership.permissions.includes('inventory.manage')
  const canReport = membership.permissions.includes('reports.read')
  const stock = useQuery<Product[]>({ queryKey: ['operations-stock', orgId, store.id], queryFn: () => operationsRequest<Product[]>(orgId, `stores/${store.id}/stock`), enabled: mode === 'operations', retry: false })
  const report = useQuery<Report>({ queryKey: ['operations-report', orgId, store.id, day], queryFn: () => operationsRequest<Report>(orgId, `stores/${store.id}/reports${day ? `?day=${day}` : ''}`), enabled: canReport, retry: false })
  const movements = useQuery<Movement[]>({ queryKey: ['operations-movements', orgId, store.id], queryFn: () => operationsRequest<Movement[]>(orgId, `stores/${store.id}/movements`), enabled: mode === 'operations' && canReport && tab === 'stock', retry: false })

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const form = event.currentTarget
    const values = new FormData(form)
    try {
      await operationsRequest(orgId, 'products', 'POST', {
        name: String(values.get('name') || ''), sku: String(values.get('sku') || ''),
        barcode: String(values.get('barcode') || '') || null,
        price_minor: minor(String(values.get('price') || '0')),
        cost_minor: minor(String(values.get('cost') || '0')),
        low_stock_threshold: Number(values.get('threshold') || 0),
      })
      form.reset(); setMessage('Product added. Receive stock to make it available for sale.')
      await cache.invalidateQueries({ queryKey: ['operations-stock', orgId, store.id] })
    } catch (reason) { setError(errorText(reason)) } finally { setBusy(false) }
  }
  async function receiveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const form = event.currentTarget
    const values = new FormData(form)
    try {
      await operationsRequest(orgId, `stores/${store.id}/stock`, 'POST', {
        product_id: String(values.get('product_id')), quantity: Number(values.get('quantity')),
        kind: String(values.get('kind')), note: String(values.get('note') || ''),
      })
      form.reset(); setMessage('Stock received and recorded in the movement history.')
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['operations-stock', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['operations-movements', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['operations-report', orgId, store.id] }),
        cache.invalidateQueries({ queryKey: ['terminal-products', orgId, store.id] }),
      ])
    } catch (reason) { setError(errorText(reason)) } finally { setBusy(false) }
  }
  const stockRows = stock.data || []
  const lowCount = stockRows.filter(item => item.low_stock && item.active).length
  return <>
    {mode === 'operations' && <><div className="operations-summary"><div><span>Products</span><strong>{stockRows.length}</strong><small>In your catalog</small></div><div className={lowCount ? 'needs-attention' : ''}><span>Low stock</span><strong>{lowCount}</strong><small>At or below threshold</small></div><div><span>Units on hand</span><strong>{stockRows.reduce((sum, item) => sum + item.quantity, 0)}</strong><small>{store.name}</small></div></div>
    <div className="section-tabs operations-tabs" role="tablist" aria-label="Operations views"><button role="tab" aria-selected={tab === 'stock'} className={tab === 'stock' ? 'selected' : ''} onClick={() => setTab('stock')}>Stock status</button><button role="tab" aria-selected={tab === 'catalog'} className={tab === 'catalog' ? 'selected' : ''} onClick={() => setTab('catalog')}>Catalog</button><button role="tab" aria-selected={tab === 'reports'} className={tab === 'reports' ? 'selected' : ''} onClick={() => setTab('reports')}>Reports</button></div></>}
    {error && <p role="alert" className="retail-error retail-feedback">{error}</p>}{message && <p role="status" className="retail-success retail-feedback">{message}</p>}
    {tab === 'stock' && <div className="operations-columns"><section className="panel"><div className="retail-panel-title"><div><h2>Stock status</h2><p>Current quantities at {store.name}.</p></div><AlertTriangle size={19} aria-hidden="true" /></div>{stock.isPending && <p role="status">Loading stock…</p>}{stock.isError && <p className="retail-error">{errorText(stock.error)}</p>}<div className="retail-table-wrap"><table className="retail-table"><thead><tr><th>Item</th><th>SKU</th><th>On hand</th><th>Status</th></tr></thead><tbody>{stockRows.map(item => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.sku}</td><td>{item.quantity}</td><td><span className={item.low_stock ? 'stock-badge low' : 'stock-badge'}>{item.low_stock ? 'Low' : 'Healthy'}</span></td></tr>)}</tbody></table>{!stockRows.length && !stock.isPending && <p className="retail-empty">No products yet. Add one in Catalog.</p>}</div></section><section className="panel"><div className="retail-panel-title"><div><h2>Receive stock</h2><p>Opening quantities and new deliveries create a ledger entry.</p></div><PackagePlus size={19} aria-hidden="true" /></div>{canStock ? <form className="retail-form" onSubmit={receiveStock}><label className="retail-field">Product<select name="product_id" required><option value="">Choose an item</option>{stockRows.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}</select></label><div className="retail-form-row"><label className="retail-field">Quantity<input name="quantity" type="number" min="1" max="1000000" required /></label><label className="retail-field">Type<select name="kind"><option value="receipt">New stock</option><option value="opening">Opening stock</option></select></label></div><label className="retail-field">Note <small>Optional</small><input name="note" maxLength={300} placeholder="Invoice or delivery reference" /></label><button className="primary-button icon-button" disabled={busy || !stockRows.length}><PackagePlus size={16} />{busy ? 'Saving…' : 'Add stock'}</button></form> : <p className="retail-helper">You can view stock but do not have permission to add it.</p>}</section></div>}
    {tab === 'stock' && canReport && <section className="panel movement-panel"><div className="retail-panel-title"><div><h2>Recent movements</h2><p>Every stock addition and sale has a source record.</p></div></div>{movements.isPending && <p className="retail-helper">Loading movements…</p>}{movements.isError && <p className="retail-error">{errorText(movements.error)}</p>}<div className="movement-list">{movements.data?.slice(0, 20).map(movement => <div key={movement.id}><span><strong>{movement.product_name}</strong><small>{movement.kind} · {new Date(movement.created).toLocaleString()}{movement.note ? ` · ${movement.note}` : ''}</small></span><strong className={movement.delta < 0 ? 'outgoing' : 'incoming'}>{movement.delta > 0 ? '+' : ''}{movement.delta}</strong></div>)}{!movements.data?.length && !movements.isPending && <p className="retail-helper">No movements recorded yet.</p>}</div></section>}
    {tab === 'catalog' && <section className="panel catalog-panel"><div className="retail-panel-title"><div><h2>Add a product</h2><p>Create an item once, then add stock at each store.</p></div><CirclePlus size={20} aria-hidden="true" /></div>{canCatalog ? <form className="retail-form catalog-form" onSubmit={createProduct}><label className="retail-field">Product name<input name="name" maxLength={160} required placeholder="e.g. Premium tea 250g" /></label><label className="retail-field">SKU<input name="sku" maxLength={60} required placeholder="e.g. TEA-250" /></label><label className="retail-field">Barcode <small>Optional</small><input name="barcode" maxLength={80} /></label><label className="retail-field">Sale price ({context.currency})<input name="price" type="number" min="0" step="0.01" required /></label><label className="retail-field">Unit cost ({context.currency})<input name="cost" type="number" min="0" step="0.01" defaultValue="0" /></label><label className="retail-field">Low-stock alert at<input name="threshold" type="number" min="0" defaultValue="5" required /></label><button className="primary-button icon-button" disabled={busy}><CirclePlus size={16} />{busy ? 'Saving…' : 'Add product'}</button></form> : <p className="retail-helper">Catalog changes require organization-wide catalog permission.</p>}</section>}
    {tab === 'reports' && <>{canReport ? <><div className="report-toolbar"><label className="retail-field">Business day<input type="date" value={day} onChange={event => setDay(event.target.value)} /></label><span>{report.data?.timezone || 'Store local time'}</span><button className="secondary-button icon-button" onClick={() => void report.refetch()}><RefreshCw size={15} />Refresh</button></div>{report.isPending && <div className="panel retail-empty" role="status">Loading report…</div>}{report.isError && <div className="panel retail-error" role="alert">{errorText(report.error)}</div>}{report.data && <><div className="report-metrics"><div className="panel"><span>Sales</span><strong>{report.data.sale_count}</strong><small>{report.data.units_sold} units sold</small></div><div className="panel"><span>Cash collected</span><strong>{money(report.data.cash_collected_minor, report.data.currency)}</strong><small>Completed cash bills</small></div><div className="panel"><span>Gross profit estimate</span><strong>{money(report.data.estimated_gross_profit_minor, report.data.currency)}</strong><small>Sales less recorded unit cost</small></div></div><div className="operations-columns"><section className="panel"><div className="retail-panel-title"><div><h2>Sales on {report.data.date}</h2><p>Bills created during the store’s business day.</p></div></div><div className="movement-list">{report.data.sales.map(sale => <div key={sale.id}><span><strong>{sale.receipt_number}</strong><small>{new Date(sale.created).toLocaleString()} · {sale.customer_type}</small></span><strong>{money(sale.total_minor, report.data.currency)}</strong></div>)}{!report.data.sales.length && <p className="retail-helper">No sales for this day.</p>}</div></section><section className="panel"><div className="retail-panel-title"><div><h2>Critical stock</h2><p>At or below the item’s low-stock threshold.</p></div></div><div className="movement-list">{report.data.low_stock.map(item => <div key={item.product_id}><span><strong>{item.name}</strong><small>{item.sku} · alert at {item.threshold}</small></span><strong className="outgoing">{item.quantity} left</strong></div>)}{!report.data.low_stock.length && <p className="retail-helper">No low-stock items.</p>}</div></section></div></>}</> : <div className="panel retail-empty">Reports require the reports permission.</div>}</>}
  </>
}
