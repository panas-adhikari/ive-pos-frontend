import { appLoginUrl } from './host'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { MarketingFooter, MarketingHeader, ProductShot } from './LandingPage'

const features = [
  { id: 'pos', number: '01', label: 'POINT OF SALE', title: 'Scan. Bill. Print.', name: 'terminal', alt: 'Ive POS terminal showing item search and a cash bill', tags: ['Name, SKU & barcode search', 'Pieces, packs & weight', 'Discounts', 'Cash & receipts'] },
  { id: 'inventory', number: '02', label: 'INVENTORY & PRODUCTS', title: 'One catalog. Stock by store.', name: 'inventory', alt: 'Ive POS stock status with quantities, prices, and low-stock alerts', tags: ['Receive stock', 'Low-stock alerts', 'Movement history', 'Product prices'] },
  { id: 'multi-store', number: '03', label: 'STORES & REGISTERS', title: 'Every location, connected.', name: 'stores', alt: 'Ive POS stores and registers for Kathmandu and Lalitpur', tags: ['Multiple locations', 'Registers', 'Store receipts', 'Staff assignments'] },
  { id: 'access', number: '04', label: 'PEOPLE & SECURITY', title: 'The right access for every role.', name: 'permissions', alt: 'Ive POS staff directory with owner, cashier, and inventory manager roles and their store access', tags: ['Invite staff', 'Custom permissions', 'Store access', 'MFA & backup codes'] },
  { id: 'reporting', number: '05', label: 'BUSINESS-DAY REPORTS', title: 'See how the day adds up.', name: 'reports', alt: 'Ive POS report showing daily sales, cash collected, and critical stock', tags: ['Cash collected', 'Daily bills', 'Critical stock', 'Cost-based profit estimate'] },
]

export default function FeaturesPage() {
  return <div className="public-site ive-marketing features-showroom"><a className="marketing-skip" href="#content">Skip to content</a><MarketingHeader features /><main id="content" className="marketing-container">
    <section className="features-hero" aria-labelledby="features-title"><nav className="marketing-breadcrumb" aria-label="Breadcrumb"><a href="/">Ive POS</a><span aria-hidden="true">/</span><span aria-current="page">Features</span></nav><div className="scene-heading"><h1 id="features-title">Ive POS tools.<br />See them at work.</h1><a className="marketing-button" href={appLoginUrl}>Open Ive POS <ArrowUpRight size={17} aria-hidden="true" /></a></div></section>
    <nav className="chapter-navigation" aria-label="Product feature sections">{features.map(feature => <a href={`#${feature.id}`} key={feature.id}><span>{feature.number}</span><strong>{feature.id === 'pos' ? 'Point of sale' : feature.id === 'multi-store' ? 'Multi-store' : feature.id === 'access' ? 'People & security' : feature.id === 'reporting' ? 'Reporting' : 'Inventory'}</strong><ArrowRight size={14} aria-hidden="true" /></a>)}</nav>
    {features.map(feature => <section className="feature-detail" key={feature.id} id={feature.id} aria-labelledby={`${feature.id}-title`}><div className="chapter-label">{feature.number} / {feature.label}</div><div className="scene-heading"><h2 id={`${feature.id}-title`}>{feature.title}</h2></div><div className="capability-tags">{feature.tags.map(tag => <span key={tag}>{tag}</span>)}</div><ProductShot name={feature.name} className={`showroom-${feature.name}`} alt={feature.alt} caption={feature.label.toLowerCase()} /></section>)}
    <section className="features-end" aria-labelledby="scope-title"><div><h2 id="scope-title">Ready for your store?</h2><span className="availability-note">Nepal IRD integration · Planned</span></div><a className="marketing-button" href={appLoginUrl}>Get started <ArrowUpRight size={18} aria-hidden="true" /></a></section>
  </main><MarketingFooter /></div>
}
