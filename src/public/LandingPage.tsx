import { appLoginUrl } from './host'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Menu, ScanLine, ShieldCheck, Store } from 'lucide-react'
import { motion, MotionConfig, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import type { PointerEvent, ReactNode } from 'react'
import { useRef } from 'react'
import { ProductBrand } from './Brand'
import WorkspaceFinder from './WorkspaceFinder'
import '@fontsource-variable/dm-sans'
import './public.css'
import './landing.css'

const productChapters = [
  { id: 'pos', name: 'Point of sale' }, { id: 'inventory', name: 'Inventory' },
  { id: 'stores', name: 'Multi-store' }, { id: 'access', name: 'People & access' }, { id: 'reporting', name: 'Reporting' },
]

// Keep server-rendered content visible, including when JavaScript is unavailable.
// Keyframes play once on entry rather than hiding off-screen content on the server.
function useReveal(delay = 0) {
  const reducedMotion = useReducedMotion()
  return {
    initial: false as const,
    whileInView: reducedMotion ? undefined : { opacity: [0.5, 1], y: [24, 0] },
    viewport: { once: true, amount: 0.12 },
    transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
  }
}

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reveal = useReveal(delay)
  return <motion.div className={className} {...reveal}>{children}</motion.div>
}

function ReadingProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 160, damping: 30 })
  return <motion.div className="marketing-reading-progress" style={{ scaleX }} aria-hidden="true" />
}

export function MarketingHeader({ features = false }: { features?: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null)
  const close = () => { if (menu.current) menu.current.open = false }
  const home = features ? '/' : ''
  return <header className="marketing-header"><div className="marketing-container marketing-header-inner">
    <ProductBrand />
    <nav className="marketing-desktop-nav" aria-label="Main navigation"><a href={`${home}#product`}>The product</a><a href={`${home}#stores`}>Your stores</a><a href={`${home}#access`}>Security</a><a href="/features" aria-current={features ? 'page' : undefined}>All features</a></nav>
    <a className="marketing-signin" href={appLoginUrl}>Sign in <ArrowUpRight size={16} aria-hidden="true" /></a>
    <details className="marketing-mobile-menu" ref={menu} onKeyDown={event => { if (event.key === 'Escape') { close(); menu.current?.querySelector('summary')?.focus() } }}>
      <summary aria-label="Navigation menu"><Menu size={22} aria-hidden="true" /></summary>
      <nav aria-label="Mobile navigation" onClick={close}><a href={`${home}#product`}>The product</a><a href={`${home}#stores`}>Your stores</a><a href={`${home}#access`}>Security</a><a href="/features">All features</a><a href={appLoginUrl}>Open Ive POS <ArrowUpRight size={17} aria-hidden="true" /></a></nav>
    </details>
  </div></header>
}

export function MarketingFooter() {
  return <footer className="marketing-footer marketing-container"><div><ProductBrand /><span className="footer-tagline">Retail operations. In clear view.</span></div><nav aria-label="Footer navigation"><a href="/features">Product features</a><a href={appLoginUrl}>Sign in</a><a href="/#start">Find your workspace</a></nav><span>© {new Date().getFullYear()} Ive POS</span></footer>
}

export function ProductShot({ name, alt, caption, className = '', mobile = true, hero = false }: {
  name: string; alt: string; caption: string; className?: string; mobile?: boolean; hero?: boolean
}) {
  const stage = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: stage, offset: ['start end', 'end start'] })
  const lift = useTransform(scrollYProgress, [0, 0.5, 1], [18, 0, -18])
  const y = useSpring(lift, { stiffness: 80, damping: 25 })
  const baseX = hero ? 8 : 3
  const baseY = name === 'inventory' || name === 'permissions' ? -7 : 7
  const tiltX = useMotionValue(baseX)
  const tiltY = useMotionValue(baseY)
  const rotateX = useSpring(tiltX, { stiffness: 100, damping: 24 })
  const rotateY = useSpring(tiltY, { stiffness: 100, damping: 24 })
  function move(event: PointerEvent<HTMLAnchorElement>) {
    if (reducedMotion || event.pointerType !== 'mouse') return
    const bounds = event.currentTarget.getBoundingClientRect()
    tiltX.set(baseX - ((event.clientY - bounds.top) / bounds.height - 0.5) * 5)
    tiltY.set(baseY + ((event.clientX - bounds.left) / bounds.width - 0.5) * 5)
  }
  const reset = () => { tiltX.set(baseX); tiltY.set(baseY) }
  const fullImage = `/images/product/ive-pos-${name}.webp`
  return <figure className={`product-shot product-shot-${name} ${hero ? 'product-shot-hero' : ''} ${className}`}>
    <div className="product-shot-stage" ref={stage}><motion.a className="product-image-link" href={fullImage} target="_blank" rel="noreferrer" aria-label={`Open ${caption.toLowerCase()} screenshot in a new tab`} onPointerMove={move} onPointerLeave={reset} onFocus={() => { tiltX.set(0); tiltY.set(0) }} onBlur={reset} style={reducedMotion ? { rotateX: 0, rotateY: 0, y: 0 } : { rotateX, rotateY, y }}>
      <span className="product-frame-label" aria-hidden="true"><span>IVE POS <i>/</i> {name === 'permissions' ? 'PEOPLE & ACCESS' : name.toUpperCase()}</span><span className="product-frame-dots"><i /><i /><i /></span></span>
      <picture>{mobile && <source media="(max-width: 600px)" srcSet={`/images/product/ive-pos-${name}-mobile.webp`} width={780} height={name === 'terminal' ? 2880 : 2000} />}<img src={`/images/product/ive-pos-${name}${hero ? '-hero' : ''}.webp`} alt={alt} width={2160} height={name === 'terminal' ? 1800 : 1500} loading={hero ? 'eager' : 'lazy'} fetchPriority={hero ? 'high' : 'auto'} decoding="async" /></picture>
    </motion.a></div>
    <figcaption><span>{caption} <span className="shot-sample">· Sample store data</span></span><a className="shot-open" href={fullImage} target="_blank" rel="noreferrer">View full screen <ArrowUpRight size={14} aria-hidden="true" /></a></figcaption>
  </figure>
}

const scenes = [
  { id: 'pos', tone: 'sell', label: 'AT THE COUNTER', title: 'A good day starts\nat the counter.', description: 'Find an item, build the bill, take cash. Your stock updates with every completed sale.', tags: ['Barcode search', 'Cash billing', 'Print receipts'], name: 'terminal', alt: 'Full Ive POS workspace with grocery items and a three-item cash bill at Mountain Mart', caption: 'The Ive POS terminal', href: 'pos' },
  { id: 'inventory', tone: 'stock', label: 'BEHIND THE SHELVES', title: 'Know what’s on\nyour shelves.', description: 'One product catalog. Stock counted at each store, in pieces, packs, or weight.', tags: ['Receive deliveries', 'Low-stock alerts', 'Stock history'], name: 'inventory', alt: 'Full Ive POS inventory workspace with six products, quantities, and a low-stock alert', caption: 'Stock status, by store', href: 'inventory' },
  { id: 'stores', tone: 'stores', label: 'ACROSS YOUR STORES', title: 'One shop today.\nMore tomorrow.', description: 'Give every location its own registers, contact details, and receipt identity. Manage them from one workspace.', tags: ['Store directory', 'Registers', 'Store receipts'], name: 'stores', alt: 'Full Ive POS stores table showing Kathmandu, Lalitpur, and Bhaktapur with register counts and actions', caption: 'Stores & registers', href: 'multi-store' },
  { id: 'access', tone: 'access', label: 'WITH YOUR TEAM', title: 'The right access.\nFor every person.', description: 'Cashiers, managers, and owners work with the permissions and stores assigned to them.', tags: ['Staff invitations', 'Store permissions', 'Authenticator MFA'], name: 'permissions', alt: 'Full Ive POS people directory with owner, cashier, and inventory manager roles and store access', caption: 'People & access', href: 'access' },
  { id: 'reporting', tone: 'report', label: 'AT THE END OF THE DAY', title: 'Close the day\nwith a clear picture.', description: 'Review completed bills, cash collected, and critical stock for your store’s local business day.', tags: ['Daily bills', 'Cash collected', 'Cost-based profit estimate'], name: 'reports', alt: 'Full Ive POS business-day report with four bills, cash totals, gross profit estimate, and critical stock', caption: 'The business-day report', href: 'reporting' },
]

export default function LandingPage() {
  return <MotionConfig reducedMotion="user"><div className="public-site ive-marketing landing-showroom">
    <ReadingProgress />
    <a className="marketing-skip" href="#content">Skip to content</a><MarketingHeader />
    <main id="content">
      <section className="marketing-hero marketing-container" id="product" aria-labelledby="landing-title">
        <div className="hero-identity"><span><i aria-hidden="true" /> RETAIL SOFTWARE / NEPAL</span><span>From your first sale to your next store.</span></div>
        <div className="hero-composition"><Reveal><h1 id="landing-title" className="marketing-display">Ive POS.<br /><span>Retail, in clear view.</span></h1></Reveal><Reveal className="hero-introduction" delay={0.1}><p>Sales at the counter. Stock on the shelves. People in your stores. One workspace to keep it all in view.</p><div className="marketing-actions"><a className="marketing-button" href={appLoginUrl}>Open Ive POS <ArrowUpRight size={18} aria-hidden="true" /></a><a className="marketing-link" href="#pos">Take a look <ArrowDown size={17} aria-hidden="true" /></a></div></Reveal></div>
        <div className="hero-product-stage">
          <div className="hero-stage-line" aria-hidden="true" /><div className="hero-back-screen" aria-hidden="true"><img src="/images/product/ive-pos-terminal.webp" width="2160" height="1800" alt="" decoding="async" /></div>
          <ProductShot name="inventory" hero mobile={false} alt="Full Ive POS workspace showing the navigation, six stock items, and their quantities at Mountain Mart" caption="Inside your retail workspace" />
          <div className="hero-receipt" aria-hidden="true"><span className="receipt-store">Mountain Mart</span><span className="receipt-subtitle">KATHMANDU / SAMPLE BILL</span><div className="receipt-items"><span>Basmati rice <b>180.00</b></span><span>Mustard oil <b>280.00</b></span><span>Ilam tea <b>180.00</b></span></div><div className="receipt-total"><span>Total / NPR</span><strong>640.00</strong></div><span className="hero-barcode" /><span className="receipt-thanks">Thank you for shopping locally.</span></div>
        </div>
        <div className="hero-foundations"><span><ScanLine size={17} aria-hidden="true" />Point of sale & inventory</span><span><Store size={17} aria-hidden="true" />Built for multiple stores</span><span><ShieldCheck size={17} aria-hidden="true" />Roles, permissions & MFA</span></div>
      </section>
      <nav className="chapter-navigation marketing-container" aria-label="Explore Ive POS workflows">{productChapters.map((chapter, index) => <a key={chapter.id} href={`#${chapter.id}`}><span>0{index + 1}</span><strong>{chapter.name}</strong><ArrowDown size={15} aria-hidden="true" /></a>)}</nav>
      {scenes.map((scene, index) => <section className={`marketing-scene scene-${scene.tone}`} id={scene.id} key={scene.id} aria-labelledby={`${scene.id}-title`}><div className="marketing-container">
        <div className="chapter-label"><span>0{index + 1}</span>{scene.label}</div>
        <Reveal className="scene-heading"><h2 id={`${scene.id}-title`}>{scene.title}</h2><div className="scene-introduction"><p>{scene.description}</p><a className="marketing-link" href={`/features#${scene.href}`}>Explore tools <ArrowRight size={17} aria-hidden="true" /></a></div></Reveal>
        <div className="capability-tags">{scene.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
        <div className="scene-product-stage"><ProductShot name={scene.name} className={`showroom-${scene.name}`} alt={scene.alt} caption={scene.caption} /></div>
      </div></section>)}
      <section className="marketing-start" id="start" aria-labelledby="start-title"><div className="marketing-container start-composition">
        <div><div className="chapter-label">YOUR NEXT WORKING DAY</div><h2 id="start-title">Open your store.<br />We’ll guide the setup.</h2><p className="start-description">Secure your account, confirm your business details, and add your first store and register in Quick setup.</p><div className="setup-path"><span><Check size={14} aria-hidden="true" />Secure account</span><ArrowRight size={14} aria-hidden="true" /><span>Store</span><ArrowRight size={14} aria-hidden="true" /><span>Register</span></div><a className="marketing-button" href={appLoginUrl}>Sign in or create an account <ArrowUpRight size={18} aria-hidden="true" /></a><span className="availability-note">Nepal IRD integration · Planned</span></div><div className="workspace-entry"><span className="workspace-entry-label">ALREADY HAVE A STORE?</span><h3>Find your workspace.</h3><WorkspaceFinder /></div>
      </div></section>
    </main><MarketingFooter />
  </div></MotionConfig>
}
