// Capture the actual application with illustrative API fixtures, never customer data.
// Run from frontend after npm run build, with the preview on port 4173.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

process.env.NO_PROXY = 'localhost,127.0.0.1'
process.env.no_proxy = process.env.NO_PROXY
const origin = 'http://127.0.0.1:4173'
const output = 'artifacts/product-captures'
await mkdir(output, { recursive: true })
const permissions = ['organization.read', 'organization.setup', 'employees.manage', 'store.read', 'catalog.manage', 'inventory.manage', 'sales.create', 'reports.read']
const organization = { id: 'sample-org', name: 'Mountain Mart', organization_type: 'retail', location_label: 'Kathmandu', image_url: '', website_url: '', configured: true, version: 1, currency: 'NPR', timezone: 'Asia/Kathmandu', receipt_footer: 'Thank you for shopping locally.', phone: '01-5550100', contact_email: 'hello@example.test', store_limit: 5, employee_limit: 10 }
const stores = [
  { id: 'ktm', code: 'KTM', name: 'Kathmandu', address: 'New Road, Kathmandu', opening_hours: 'Sunday–Friday, 9 am–7 pm', registers: [{ id: 'ktm-1', code: 'POS01', name: 'Front counter', active: true, version: 1 }, { id: 'ktm-2', code: 'POS02', name: 'Express counter', active: true, version: 1 }] },
  { id: 'lal', code: 'LAL', name: 'Lalitpur', address: 'Patan, Lalitpur', opening_hours: 'Sunday–Friday, 9 am–7 pm', registers: [{ id: 'lal-1', code: 'POS01', name: 'Main counter', active: true, version: 1 }] },
  { id: 'bkt', code: 'BKT', name: 'Bhaktapur', address: 'Suryabinayak, Bhaktapur', opening_hours: 'Sunday–Friday, 10 am–6 pm', registers: [{ id: 'bkt-1', code: 'POS01', name: 'Main counter', active: true, version: 1 }] },
].map(store => ({ ...store, phone: '01-5550100', contact_email: 'hello@example.test', timezone: 'Asia/Kathmandu', receipt_name: `Mountain Mart · ${store.name}`, receipt_footer: organization.receipt_footer, active: true, version: 1 }))
const products = [
  { name: 'Basmati rice', category: 'Grocery', stock_unit: 'gram', price_minor: 18000, cost_minor: 14500, quantity: 24000, presets: [{ name: '5 kg bag', quantity: 5000, price_minor: 85000 }] },
  { name: 'Mustard oil · 1 L', category: 'Grocery', stock_unit: 'piece', price_minor: 28000, cost_minor: 23000, quantity: 38 },
  { name: 'Ilam tea · 250 g', category: 'Tea & coffee', stock_unit: 'piece', price_minor: 18000, cost_minor: 13500, quantity: 16 },
  { name: 'Masoor dal', category: 'Grocery', stock_unit: 'gram', price_minor: 16000, cost_minor: 13000, quantity: 18000 },
  { name: 'Himalayan salt · 1 kg', category: 'Grocery', stock_unit: 'piece', price_minor: 4500, cost_minor: 3500, quantity: 4, low_stock: true },
  { name: 'Wai Wai noodles', category: 'Snacks', stock_unit: 'piece', price_minor: 2500, cost_minor: 2000, quantity: 72 },
].map((product, index) => ({ id: `product-${index}`, sku: `MM-00${index + 1}`, barcode: null, presets: [], low_stock: false, low_stock_threshold: product.stock_unit === 'gram' ? 5000 : 5, active: true, ...product }))
const sales = [85000, 54000, 33000, 18000].map((total, index) => ({ id: `sale-${index}`, receipt_number: `KTM-0012${4 - index}`, created: `2026-10-08T0${9 - index}:15:00+05:45`, total_minor: total, customer_type: 'walkin' }))
const report = { date: '2026-10-08', timezone: 'Asia/Kathmandu', currency: 'NPR', sale_count: 4, units_sold: 12, gross_sales_minor: 190000, cash_collected_minor: 190000, estimated_cost_minor: 151000, estimated_gross_profit_minor: 39000, low_stock: [{ product_id: 'product-4', name: products[4].name, sku: products[4].sku, quantity: 4, stock_unit: 'piece', threshold: 5 }], sales }
const members = [
  { id: 'owner', user_id: 'sample-admin', email: 'asha@example.test', roles: ['owner'], permissions, all_stores: true, store_ids: [] },
  { id: 'cashier', user_id: 'sample-cashier', email: 'sita@example.test', roles: ['cashier'], permissions: ['store.read', 'sales.create'], all_stores: false, store_ids: ['ktm'] },
  { id: 'manager', user_id: 'sample-manager', email: 'bikash@example.test', roles: ['inventory_manager'], permissions: ['store.read', 'inventory.manage'], all_stores: false, store_ids: ['ktm', 'lal'] },
].map(member => ({ ...member, active: true, version: 1 }))

const browser = await chromium.launch()
const findings = []
try {
  for (const mobile of [false, true]) {
    const viewport = mobile ? { width: 390, height: 1000 } : { width: 1440, height: 1000 }
    const page = await browser.newPage({ viewport, deviceScaleFactor: mobile ? 2 : 1.5, reducedMotion: 'reduce', timezoneId: 'Asia/Kathmandu' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      const respond = json => route.fulfill({ json })
      if (route.request().method() !== 'GET') throw Error(`Capture attempted to mutate data: ${path}`)
      if (path.endsWith('/public/site')) return respond({ platform_url: 'https://ivepos.me', tenant_base_domain: 'ivepos.me', organization: null })
      if (path.endsWith('/auth/me')) return respond({ id: 'sample-admin', full_name: 'Asha Shrestha', email: 'asha@example.test', phone: '', job_title: 'Owner', platform_role: 'none', session_id: 'sample-session', email_verified: true, mfa_enabled: true, must_change_password: false, require_action_verification: false, step_up_expires: '2030-01-01T00:00:00Z', memberships: [{ organization_id: organization.id, name: organization.name, organization_type: 'retail', image_url: '', all_stores: true, store_ids: [], roles: ['owner'], permissions }] })
      if (path.endsWith('/auth/capabilities')) return respond({ email: true, mfa: true })
      if (path.endsWith('/ready')) return respond({ status: 'ready' })
      if (path.endsWith('/setup')) return respond({ organization, stores, currencies: ['NPR'], timezones: ['Asia/Kathmandu'] })
      if (path.endsWith('/context')) return respond({ organization: organization.name, currency: 'NPR', stores })
      if (path.endsWith('/products') || path.endsWith('/stock')) return respond(products)
      if (path.endsWith('/customers')) return respond([])
      if (path.endsWith('/sales')) return respond(sales)
      if (path.endsWith('/reports')) return respond(report)
      if (path.endsWith('/movements')) return respond([{ id: 'movement-1', product_name: 'Basmati rice', stock_unit: 'gram', kind: 'delivery', delta: 10000, created: '2026-10-08T08:30:00+05:45', note: 'Morning delivery' }])
      if (path.endsWith('/employees')) return respond({ memberships: members, stores, roles: { owner: permissions, cashier: ['store.read', 'sales.create'], inventory_manager: ['store.read', 'inventory.manage'] }, role_all_stores: ['owner'], grantable_permissions: permissions })
      if (path.endsWith('/invitations')) return respond([])
      throw Error(`Missing capture fixture: ${path}`)
    })
    await page.goto(`${origin}/app`, { waitUntil: 'networkidle' })
    const capture = async name => {
      await page.evaluate(async (target) => {
        await document.fonts.ready
        document.activeElement?.blur()
        const main = document.querySelector('.controller-main')
        main.scrollTop = 0
        if (target) {
          const cart = document.querySelector('.terminal-cart')
          main.scrollTop = cart.getBoundingClientRect().top - main.getBoundingClientRect().top - 20
        }
      }, mobile && name === 'terminal')
      await page.mouse.move(0, 0)
      const alerts = await page.getByRole('alert').allTextContents()
      assert.deepEqual(alerts, [], `${name} has an error`)
      assert.deepEqual(errors, [])
      const file = `${output}/${name}${mobile ? '-mobile' : ''}.png`
      await page.screenshot({ path: file })
      findings.push({ name, viewport: page.viewportSize(), file, errors: [...errors] })
    }
    await page.getByRole('button', { name: 'Add Basmati rice to cart' }).click()
    await page.getByRole('button', { name: 'Add Mustard oil · 1 L to cart' }).click()
    await page.getByRole('button', { name: 'Add Ilam tea · 250 g to cart' }).click()
    await page.getByLabel('Cash received', { exact: true }).fill('1000')
    await page.setViewportSize({ width: viewport.width, height: mobile ? 1440 : 1200 })
    await capture('terminal')
    await page.setViewportSize(viewport)
    await page.getByRole('button', { name: 'Inventory', exact: true }).click()
    await page.getByRole('tab', { name: 'Stock Status' }).click()
    await page.locator(mobile ? '.stock-mobile-card' : '.stock-status-table tbody tr').first().waitFor()
    await capture('inventory')
    await page.getByRole('button', { name: 'Stores & registers', exact: true }).click()
    await page.locator('.stores-directory tbody tr').first().waitFor()
    await capture('stores')
    await page.getByRole('button', { name: 'View store Kathmandu', exact: true }).click()
    await capture('store-detail')
    await page.getByRole('button', { name: 'People & access', exact: true }).click()
    await page.getByRole('article', { name: 'Employee sita@example.test' }).waitFor()
    await capture('permissions')
    await page.getByRole('button', { name: 'Reports', exact: true }).click()
    await page.locator('.report-metrics').waitFor()
    await page.getByLabel('Business day').fill('2026-10-08')
    await capture('reports')
    await page.close()
  }
} finally { await browser.close() }
await writeFile(`${output}/captures.json`, JSON.stringify(findings, null, 2))
// Encode the complete viewport without cropping, changing scale, or retouching it.
execFileSync('python3', ['-c', `
from pathlib import Path
from PIL import Image
for source in Path('${output}').glob('*.png'):
    image = Image.open(source)
    image.save(Path('public/images/product') / ('ive-pos-' + source.stem + '.webp'), quality=88, method=6)
Image.open(Path('${output}/inventory.png')).save('public/images/product/ive-pos-inventory-hero.webp', quality=88, method=6)
`])
console.log(`Captured ${findings.length} full application views with sample data.`)
